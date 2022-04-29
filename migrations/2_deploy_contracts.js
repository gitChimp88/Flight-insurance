const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require("fs");

module.exports = function (deployer) {
  // below is just an arbitrary address, (for the first airline)
  // but for production should be the address of an actual airline (user)
  let firstAirline = "0xf17f52151EbEF6C7334FAD080c5704D77216b732";
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
