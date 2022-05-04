const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require("fs");

module.exports = function (deployer) {
  // first airline should be first address from ganache
  let firstAirline = "0xD2116d95f30E889F7D1e499AdE58ae604920BD4c";
  let airlineName = "Fake-jet";

  deployer.deploy(FlightSuretyData, firstAirline, airlineName).then(() => {
    const dataContractAddress = FlightSuretyData.address;
    return deployer.deploy(FlightSuretyApp, dataContractAddress).then(() => {
      let config = {
        localhost: {
          url: "http://localhost:7545",
          dataAddress: dataContractAddress,
          appAddress: FlightSuretyApp.address,
        },
      };
      fs.writeFileSync(
        __dirname + "/../src/dapp/config.json",
        JSON.stringify(config, null, "\t"),
        "utf-8"
      );
      fs.writeFileSync(
        __dirname + "/../src/server/config.json",
        JSON.stringify(config, null, "\t"),
        "utf-8"
      );
    });
  });
};
