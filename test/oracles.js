var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");

contract("Oracles", async (accounts) => {
  const TEST_ORACLES_COUNT = 10;
  var config;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  before("setup contract", async () => {
    config = await Test.Config(accounts);

    // Watch contract events
    const STATUS_CODE_UNKNOWN = 0;
    // const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;
  });

  it("can register oracles", async () => {
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      await config.flightSuretyApp.registerOracle({
        from: accounts[a],
        value: fee,
      });
      let result = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });
      console.log(
        `Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`
      );
    }
  });

  it("can request flight status", async () => {
    // ARRANGE
    let flight = "ND1309"; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(
      config.firstAirline,
      flight,
      timestamp
    );
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });
      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            config.firstAirline,
            flight,
            timestamp,
            STATUS_CODE_ON_TIME,
            { from: accounts[a] }
          );
        } catch (e) {
          // Enable this when debugging
          console.log(
            "\nError",
            idx,
            oracleIndexes[idx].toNumber(),
            flight,
            timestamp
          );
        }
      }
    }
  });

  it("(passenger) can purchase insurance on a flight", async () => {
    // ARRANGE
    let passengerAddress = accounts[3];

    let flight = "KK2000";
    let timeOfDeparture = Math.floor(Date.now() / 1000);
    let timeOfArrival = Math.floor(Date.now() / 1000);
    let timestamp = Math.floor(Date.now() / 1000);

    const insurancePurchase = web3.utils.toWei("1", "ether");

    // ACT
    try {
      await config.flightSuretyApp.buyFlightInsurance(
        config.firstAirline,
        config.firstAirlineName,
        flight,
        timeOfDeparture,
        timeOfArrival,
        timestamp,
        {
          from: passengerAddress,
          value: insurancePurchase,
        }
      );
    } catch (e) {}

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(
      config.firstAirline,
      flight,
      timestamp
    );
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });
      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            config.firstAirline,
            flight,
            timestamp,
            STATUS_CODE_LATE_AIRLINE,
            { from: accounts[a] }
          );
        } catch (e) {
          // Enable this when debugging
          console.log(
            "\nError",
            idx,
            oracleIndexes[idx].toNumber(),
            flight,
            timestamp
          );
        }
      }
    }

    let insuranceAmount =
      await config.flightSuretyData.returnInsuranceAmount.call(
        passengerAddress,
        config.firstAirline,
        flight,
        timestamp
      );

    let insureeAccountBalance =
      await config.flightSuretyData.getInsureeAccountBalance.call(
        passengerAddress
      );

    let result = await config.flightSuretyData.checkAirlineRegistered.call(
      config.firstAirline
    );

    console.log("is firstAirline registered? - ", result);

    console.log("account balance here - ", BigNumber(insureeAccountBalance));
    console.log("insurance amount returned - ", BigNumber(insuranceAmount));
    console.log("insurance amount purchased - ", insurancePurchase);
    // ASSERT
    // assert.equal(
    //   insurancePurchase,
    //   BigNumber(insuranceAmount),
    //   "insurance amount hasn't been saved corectly"
    // );
    // ASSERT
    // assert.equal(
    //   insurancePurchase,
    //   BigNumber(insuranceAmount),
    //   "insurance amount hasn't been saved corectly"
    // );
    // assert.equal(result, passengerAddress, "insuree was not created");
  });
});
