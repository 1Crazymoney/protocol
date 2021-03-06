const { toBytes32, toBytes32_padded, toBytes12_padded, toUnits, to8Units, toBN, UNIT8, UNIT } = require('../../lib/utils.js');
const { execPrice } = require('./calculations');

module.exports = function(params) {
  const {
    user,
    init, // { amount, freeMargin, treasuryBalance, queueId }
    data,
    openError
  } = params;

  // const {
  //   isBuy,
  //   product,
  //   margin,
  //   leverage,
  //   openPrice
  // } = data;

  const initialFreeMargin = init.freeMargin || toBN('0');
  const initialBalance = init.balance || toBN('0');
  const initialQueueId = init.queueId || toBN('0');
  const initialTreasuryBalance = init.treasuryBalance || toBN('0');
  const marketClosed = data.openPrice && data.openPrice.eq(toBN('0'));

  return [
    {
      type: 'mint',
      skip: init.amount.eq(toBN('0')),
      user,
      data: {
        amount: init.amount.mul(UNIT).div(UNIT8)
      }
    },
    {
      type: 'check-balances',
      data: {
        user
      },
      expected: {
        freeMargin: initialFreeMargin,
        balance: initialBalance,
        currencyBalance: init.amount.mul(UNIT).div(UNIT8)
      }
    },
    {
      type: 'check-treasury-balance',
      expected: {
        balance: initialTreasuryBalance
      }
    },
    {
      type: 'deposit',
      skip: init.amount.eq(toBN('0')),
      user,
      data: {
        amount: init.amount,
      }
    },
    {
      type: 'check-balances',
      data: {
        user
      },
      expected: {
        freeMargin: initialFreeMargin.add(init.amount),
        balance: initialBalance.add(init.amount.mul(UNIT).div(UNIT8)),
        currencyBalance: toBN('0')
      }
    },
    {
      type: 'check-treasury-balance',
      expected: {
        balance: initialTreasuryBalance.add(init.amount.mul(UNIT).div(UNIT8))
      }
    },
    {
      type: 'submit-order',
      user,
      data: {
        isBuy: data.isBuy,
        product: data.product,
        margin: data.margin,
        leverage: data.leverage
      },
      expected: {
        event: {
          id: initialQueueId.add(toBN(1)),
          positionId: toBN(0),
          isBuy: data.isBuy,
          symbol: toBytes32_padded(data.product),
          margin: data.margin,
          leverage: data.leverage
        }
      }
    },
    {
      type: 'check-balances',
      data: {
        user
      },
      expected: {
        freeMargin: initialFreeMargin.add(init.amount).sub(data.margin),
        balance: initialBalance.add(init.amount.mul(UNIT).div(UNIT8)),
        currencyBalance: toBN('0')
      }
    },
    {
      type: 'check-queue',
      expected: {
        symbols: [ data.product ].map(toBytes32),
        firstId: initialQueueId.add(toBN(1)),
        lastId: initialQueueId.add(toBN(2))
      }
    },
    {
      type: 'set-prices',
      skip: !data.openPrice,
      user: 'oracle',
      data: {
        prices: [ data.openPrice ],
        firstId: initialQueueId.add(toBN(1))
      },
      expected: {
        events:
          (marketClosed || openError ?
            /* market closed */
            {
              'OrderCancelled': [
                {
                  id: initialQueueId.add(toBN(1)),
                  positionId: initialQueueId.add(toBN(1)),
                  reason: openError || '!unavailable'
                }
              ]
            }
          :
            {
              'PositionOpened': [
                {
                  positionId: initialQueueId.add(toBN(1)),
                  isBuy: data.isBuy,
                  symbol: toBytes32_padded(data.product),
                  margin: data.margin,
                  leverage: data.leverage,
                  price: execPrice({ isBuy: data.isBuy, price: data.openPrice })
                }
              ]
            }
          )
      }
    },
    {
      type: 'check-balances',
      skip: !data.openPrice,
      data: {
        user
      },
      expected: {
        freeMargin: initialFreeMargin.add(init.amount).sub((marketClosed || openError) ? toBN('0') : data.margin),
        balance: initialBalance.add(init.amount.mul(UNIT).div(UNIT8)),
        currencyBalance: toBN('0')
      }
    },
    {
      type: 'check-user-positions',
      skip: !data.openPrice,
      data: {
        user,
      },
      expected: (marketClosed || openError) ? [ /* market closed */ ] : [
        {
          id: initialQueueId.add(toBN(1)),
          isBuy: data.isBuy,
          symbol: toBytes12_padded(data.product),
          margin: data.margin,
          leverage: data.leverage,
          price: execPrice({ isBuy: data.isBuy, price: data.openPrice })
        }
      ]
    }
  ];
}