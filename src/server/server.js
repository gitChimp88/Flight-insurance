import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

const app = express();

(async () => {
  // Prepare params
  let config = Config["localhost"];

  let web3 = new Web3(
    new Web3.providers.WebsocketProvider(
      config.url.replace("http", "ws").replace("localhost", "127.0.0.1")
    )
  );

  const ORACLE_AMOUNT = 20;

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

  console.log("oracleRegistrationfee " + oracleRegistrationfee);

  for (let account = 1; account <= ORACLE_AMOUNT; account++) {
    idx = 10 + account;
    oracleAccount = accounts[idx];

    // Register
    console.log("Register Oracle " + oracleAccount + "...");

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

    // Save indexes
    oracleData[oracleAccount] = indexes;
  }

  console.log("oracle data here - ", oracleData);

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
            console.log(
              "logging out oracle indexes to see if they match - ",
              oracleIndexes[oracleIdx]
            );
            if (parseInt(oracleIndexes[oracleIdx]) === oracleIndex) {
              // This oracle has the correct index so send status back
              // hardcoded status code
              statusCode = 20;
              console.log("oracle index matches time to send flight status");
              // Send response to Smart Contract
              await flightSuretyApp.methods
                .submitOracleResponse(
                  event.returnValues.index,
                  airlineAddress,
                  flight,
                  timestamp,
                  statusCode
                )
                .send({ from: accounts[accountIndex], gas: 1000000 });

              console.log(
                "Submit Oracle Response sent from " +
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
