// IDL captured from the BUMM build of tranched_vault V4 (uid 6d7e1e72…),
// address pinned to the deployed program id.
export const VAULT_IDL = {
  "address": "DvqUzXXWUdLqCnpy6Nb59PY29oVamfC7ME6bNimHxCGa",
  "metadata": {
    "name": "tranched_vault",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "claim_junior",
      "docs": [
        "Pay the junior tranche the coupon it has accrued but not yet received."
      ],
      "discriminator": [
        248,
        160,
        216,
        230,
        191,
        106,
        53,
        71
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "destination",
          "docs": [
            "The claimant's vault-asset token account receiving the coupon."
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claim_senior",
      "docs": [
        "Pay the senior tranche the coupon it has accrued but not yet received."
      ],
      "discriminator": [
        148,
        75,
        56,
        56,
        2,
        114,
        48,
        50
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "destination",
          "docs": [
            "The claimant's vault-asset token account receiving the coupon."
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "deposit_junior",
      "docs": [
        "Deposit into the junior tranche: assets move into the vault, junior",
        "tranche tokens are minted 1:1 to the depositor."
      ],
      "discriminator": [
        4,
        71,
        156,
        106,
        25,
        232,
        177,
        157
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "source",
          "docs": [
            "The depositor's vault-asset token account."
          ],
          "writable": true
        },
        {
          "name": "junior_mint",
          "writable": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "tranche_account",
          "docs": [
            "The depositor's junior tranche token account (created on first use)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "junior_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "deposit_senior",
      "docs": [
        "Deposit into the senior tranche: assets move into the vault, senior",
        "tranche tokens are minted 1:1 to the depositor."
      ],
      "discriminator": [
        218,
        97,
        124,
        117,
        212,
        161,
        218,
        219
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "source",
          "docs": [
            "The depositor's vault-asset token account."
          ],
          "writable": true
        },
        {
          "name": "senior_mint",
          "writable": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "tranche_account",
          "docs": [
            "The depositor's senior tranche token account (created on first use)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "senior_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "distribute_revenue",
      "docs": [
        "Distribute revenue through the waterfall: senior is paid first, up to",
        "its per-distribution coupon on senior principal; junior takes the",
        "residual."
      ],
      "discriminator": [
        94,
        34,
        239,
        201,
        147,
        227,
        29,
        30
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "source",
          "docs": [
            "The operator's vault-asset token account revenue is paid from."
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "draw_capital",
      "docs": [
        "Operator draws raised capital out of the vault (demo stand-in for",
        "\"capital leaves the vault to purchase hardware\")."
      ],
      "discriminator": [
        177,
        123,
        139,
        211,
        98,
        60,
        87,
        178
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "destination",
          "docs": [
            "The operator's vault-asset token account receiving the capital."
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "faucet",
      "docs": [
        "Devnet self-service faucet: mint demo asset tokens to the caller so",
        "any wallet can try the vault. Works for mints whose mint authority",
        "has been handed to the faucet PDA. Capped per call; devnet toy only."
      ],
      "discriminator": [
        0,
        98,
        59,
        30,
        144,
        142,
        113,
        12
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "asset_mint",
          "writable": true
        },
        {
          "name": "faucet_authority",
          "docs": [
            "demo asset mints; only ever used as a CPI signer, never read."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  117,
                  99,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              }
            ]
          }
        },
        {
          "name": "user_account",
          "docs": [
            "The caller's demo-asset token account (created on first use)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Create the vault, its asset token account and both tranche mints.",
        "`senior_coupon_bps` is the senior per-distribution coupon (800 = 8%",
        "of senior principal per revenue distribution). `contract_monthly` and",
        "`contract_months` describe the offtake contract being securitized."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "asset_mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "senior_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  105,
                  111,
                  114,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "junior_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  110,
                  105,
                  111,
                  114,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "senior_coupon_bps",
          "type": "u16"
        },
        {
          "name": "contract_monthly",
          "type": "u64"
        },
        {
          "name": "contract_months",
          "type": "u16"
        }
      ]
    },
    {
      "name": "record_loss",
      "docs": [
        "Record a loss against tranche principal, junior first, and burn the",
        "corresponding tranche tokens so outstanding supply tracks surviving",
        "principal. Errors if the loss exceeds total remaining capacity."
      ],
      "discriminator": [
        112,
        182,
        48,
        145,
        171,
        216,
        247,
        43
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "senior_mint",
          "writable": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "junior_mint",
          "writable": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "senior_account",
          "docs": [
            "The authority's senior tranche token account (burn source)."
          ],
          "writable": true
        },
        {
          "name": "junior_account",
          "docs": [
            "The authority's junior tranche token account (burn source)."
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem_junior",
      "docs": [
        "Redeem junior tranche tokens 1:1 back into the vault asset."
      ],
      "discriminator": [
        37,
        42,
        189,
        190,
        4,
        92,
        234,
        60
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "junior_mint",
          "writable": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "tranche_account",
          "docs": [
            "The redeemer's junior tranche token account (burn source)."
          ],
          "writable": true
        },
        {
          "name": "destination",
          "docs": [
            "The redeemer's vault-asset token account receiving the payout."
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem_senior",
      "docs": [
        "Redeem senior tranche tokens 1:1 back into the vault asset."
      ],
      "discriminator": [
        105,
        103,
        120,
        29,
        178,
        111,
        157,
        209
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "senior_mint",
          "writable": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "tranche_account",
          "docs": [
            "The redeemer's senior tranche token account (burn source)."
          ],
          "writable": true
        },
        {
          "name": "destination",
          "docs": [
            "The redeemer's vault-asset token account receiving the payout."
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "repay_capital",
      "docs": [
        "Operator returns drawn capital to the vault \u2014 the mirror of",
        "`draw_capital`. At the end of an offtake period the hardware is sold",
        "or refinanced and the principal comes home, which is what lets the",
        "tranches redeem in full."
      ],
      "discriminator": [
        174,
        178,
        33,
        253,
        54,
        101,
        119,
        107
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "asset_mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "vault_tokens",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "source",
          "docs": [
            "The operator's vault-asset token account revenue is paid from."
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "Vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "CapitalDrawn",
      "discriminator": [
        228,
        98,
        187,
        87,
        135,
        131,
        35,
        218
      ]
    },
    {
      "name": "CapitalRepaid",
      "discriminator": [
        215,
        39,
        239,
        8,
        40,
        203,
        237,
        189
      ]
    },
    {
      "name": "CouponClaimed",
      "discriminator": [
        37,
        168,
        115,
        183,
        112,
        176,
        208,
        244
      ]
    },
    {
      "name": "Deposited",
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ]
    },
    {
      "name": "LossAbsorbed",
      "discriminator": [
        44,
        15,
        89,
        134,
        228,
        243,
        159,
        151
      ]
    },
    {
      "name": "Redeemed",
      "discriminator": [
        14,
        29,
        183,
        71,
        31,
        165,
        107,
        38
      ]
    },
    {
      "name": "RevenueDistributed",
      "discriminator": [
        78,
        195,
        188,
        214,
        203,
        219,
        199,
        87
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidCoupon",
      "msg": "senior_coupon_bps must be <= 10000"
    },
    {
      "code": 6001,
      "name": "ZeroAmount",
      "msg": "amount must be greater than zero"
    },
    {
      "code": 6002,
      "name": "MathOverflow",
      "msg": "arithmetic overflow"
    },
    {
      "code": 6003,
      "name": "LossExceedsCapacity",
      "msg": "loss exceeds remaining tranche capacity"
    },
    {
      "code": 6004,
      "name": "ExceedsOutstanding",
      "msg": "amount exceeds outstanding tranche principal"
    },
    {
      "code": 6005,
      "name": "InsufficientTrancheTokens",
      "msg": "not enough tranche tokens to burn"
    },
    {
      "code": 6006,
      "name": "FaucetLimit",
      "msg": "faucet amount exceeds the per-call cap"
    },
    {
      "code": 6007,
      "name": "NothingToClaim",
      "msg": "no coupon has accrued to claim yet"
    },
    {
      "code": 6008,
      "name": "WrongMint",
      "msg": "token account mint does not match"
    },
    {
      "code": 6009,
      "name": "WrongOwner",
      "msg": "token account owner does not match authority"
    }
  ],
  "types": [
    {
      "name": "CapitalDrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "total_drawn",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "CapitalRepaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "outstanding",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "CouponClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tranche",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Deposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tranche",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "LossAbsorbed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "junior_absorbed",
            "type": "u64"
          },
          {
            "name": "senior_absorbed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Redeemed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tranche",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "RevenueDistributed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "senior_cut",
            "type": "u64"
          },
          {
            "name": "junior_cut",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "asset_mint",
            "type": "pubkey"
          },
          {
            "name": "senior_mint",
            "type": "pubkey"
          },
          {
            "name": "junior_mint",
            "type": "pubkey"
          },
          {
            "name": "senior_deposited",
            "type": "u64"
          },
          {
            "name": "junior_deposited",
            "type": "u64"
          },
          {
            "name": "senior_coupon_bps",
            "type": "u16"
          },
          {
            "name": "senior_paid",
            "type": "u64"
          },
          {
            "name": "junior_paid",
            "type": "u64"
          },
          {
            "name": "total_revenue",
            "type": "u64"
          },
          {
            "name": "senior_loss",
            "type": "u64"
          },
          {
            "name": "junior_loss",
            "type": "u64"
          },
          {
            "name": "capital_drawn",
            "type": "u64"
          },
          {
            "name": "contract_monthly",
            "type": "u64"
          },
          {
            "name": "contract_months",
            "type": "u16"
          },
          {
            "name": "senior_claimed",
            "docs": [
              "Coupon already paid out to each tranche, so `claim_*` only ever",
              "transfers the newly accrued slice."
            ],
            "type": "u64"
          },
          {
            "name": "junior_claimed",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
} as const;
