import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

const app = express();

(async () => {
  // Prepare params
  let config = Config["localhost"];
  let web3 = new Web3(
    new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
  );

  const ORACLE_AMOUNT = 5;

  // Get Accounts from Ganache
  let accounts = await web3.eth.getAccounts();
  console.log("accounts = ", accounts);

  // Get Contract
  let flightSuretyApp = new web3.eth.Contract(
    FlightSuretyApp.abi,
    config.appAddress
  );

  // ---------------------------------------------------- //
  //                        Oracles                       //
  // ---------------------------------------------------- //

  // Below is registering oracles on startup
  let oracleRegistrationfee = await flightSuretyApp.methods
    .REGISTRATION_FEE()
    .call();
  let idx;
  let oracleData = {};
  let oracleAccount;
  let indexes;
  let isRegistred;
  let isRegistredOracle;

  console.log("oracleRegistrationfee " + oracleRegistrationfee);

  for (let account = 1; account <= ORACLE_AMOUNT; account++) {
    idx = 10 + account;
    oracleAccount = accounts[idx];

    // Register
    console.log("Register Oracle " + oracleAccount + "...");

    isRegistredOracle = await flightSuretyApp.methods
      .isRegistredOracle()
      .call({ from: oracleAccount });
    const { 0: isRegistred, 1: indexes } = isRegistredOracle;

    if (!isRegistred) {
      await flightSuretyApp.methods.registerOracle().send({
        from: oracleAccount,
        value: oracleRegistrationfee,
        gas: 6000000,
      });
      console.log("Oracle registred!");

      // Get Oracle indexes and save them
      indexes = await flightSuretyApp.methods
        .getMyIndexes()
        .call({ from: oracleAccount });
      console.log(
        "Oracle indexes: " + indexes[0] + ", " + indexes[1] + ", " + indexes[2]
      );
    }

    // Save indexes
    oracleData[oracleAccount] = indexes;
  }

  console.log(oracleData);

  /**
     *
        {
            logIndex: 0,
            transactionIndex: 0,
            transactionHash: '0xcf6950689551aa972e115014d98bd6622bc5474296d4034974b6ca2a5c33ec3e',
            blockHash: '0x3a8e0c224f2e94c03fa61bbff2c5f7ce1103fff24ac4a734181e47504493034c',
            blockNumber: 259,
            address: '0x2fD01C35f961c0E833902B87790cda06E7F51448',
            type: 'mined',
            removed: false,
            id: 'log_0xc8c519ec6316328ab58f60582fbc63e74beab35374133de90b6d64602f2c79cc',
            returnValues: {
                '0': 6,
                '1': '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
                '2': 'TestFlight4',
                '3': BigNumber { _hex: '0x622d3a8e' },
                index: 6,
                airline: '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
                flight: 'TestFlight4',
                timestamp: BigNumber { _hex: '0x622d3a8e' }
            },
            event: 'OracleRequest',
            signature: '0x3ed01f2c3fc24c6b329d931e35b03e390d23497d22b3f90e15b600343e93df11',
            raw: {
            data: '0x0000000000000000000000000000000000000000000000000000000000000006000000000000000000000000f17f52151ebef6c7334fad080c5704d77216b732000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000622d3a8e000000000000000000000000000000000000000000000000000000000000000b54657374466c6967687434',
            topics: [
              '0x3ed01f2c3fc24c6b329d931e35b03e390d23497d22b3f90e15b600343e93df11'
            ]
            }
        }
     */
  // Listening for Smart Contract requests
  flightSuretyApp.events.OracleRequest(
    {
      fromBlock: "latest",
    },
    async function (error, event) {
      let accountIndex;
      let checkOracleAccount;
      let oracleIndexes;
      let oracleIndex;
      let airlineAddress;
      let flight;
      let timestamp;
      let statusCode;

      if (error) console.log(error);
      else {
        console.log(event);
        oracleIndex = parseInt(event.returnValues.index);
        airlineAddress = event.returnValues.airline;
        flight = event.returnValues.flight;
        timestamp = event.returnValues.timestamp;

        console.log(
          "Request data: oracleIndexRequested " +
            oracleIndex +
            ", airlineAddress " +
            airlineAddress +
            ", flight " +
            flight +
            ", timestamp " +
            timestamp
        );

        // Send the flight status only from correct oracles
        for (let account = 1; account <= ORACLE_AMOUNT; account++) {
          accountIndex = 10 + account; // checking oracles from acount 11 as assigned above.
          checkOracleAccount = accounts[accountIndex];
          oracleIndexes = oracleData[checkOracleAccount];

          // Check whether the oracle has a correct index
          for (
            let oracleIdx = 0;
            oracleIdx < oracleIndexes.length;
            oracleIdx++
          ) {
            if (oracleIndexes[oracleIdx] === oracleIndex) {
              // This oracle has the correct index so send status back
              // hardcoded status code
              statusCode = 20;

              // Send response to Smart Contract
              await flightSuretyApp.methods
                .submitOracleResponse(
                  oracleIndex,
                  airlineAddress,
                  flight,
                  timestamp,
                  statusCode
                )
                .send({ from: accounts[accountIndex], gas: 1000000 });

              console.log(
                "SubmitOracleResponse sent from " +
                  checkOracleAccount +
                  " with data |" +
                  airlineAddress +
                  "|" +
                  flight +
                  "|" +
                  timestamp +
                  "| Flight status code " +
                  statusCode
              );
            }
          }
        }
      }
    }
  );

  // ---------------------------------------------------- //
  //                     API services                     //
  // ---------------------------------------------------- //

  app.get("/api", (req, res) => {
    res.send({
      message: "An API for use with your Dapp!",
    });
  });
})();

export default app;
