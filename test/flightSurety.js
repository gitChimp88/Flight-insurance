var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false, {
        from: config.testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(
      accessDenied,
      false,
      "Access not restricted to Contract Owner"
    );
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await config.flightSuretyData.setOperatingStatus(false);

    let reverted = false;
    try {
      await config.flightSurety.setTestingMode(true);
    } catch (e) {
      reverted = true;
    }
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true);
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, {
        from: config.firstAirline,
      });
    } catch (e) {}
    let result = await config.flightSuretyData.checkAirlineRegistered.call(
      newAirline
    );

    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
  });

  it("(airline) registered as having contributed once it's provided funding", async () => {
    // ARRANGE
    let newAirline = accounts[2];
    let airlineName = "newAirline";
    const airlineRegistrationFee = web3.utils.toWei("10", "ether");

    await config.flightSuretyData.setOperatingStatus(true);
    // ACT
    try {
      await config.flightSuretyApp.fundAirline({
        from: config.firstAirline,
        value: airlineRegistrationFee,
      });
    } catch (e) {}

    let result = await config.flightSuretyData.checkAirlineContributed.call(
      config.firstAirline
    );

    // ASSERT
    assert.equal(
      result,
      true,
      "Airline should be registered as having contributed if it has provided funding"
    );
  });

  it("(airline) can be registered by another", async () => {
    // ARRANGE
    let newAirline = accounts[2];
    let airlineName = "newAirline";
    const airlineRegistrationFee = web3.utils.toWei("10", "ether");

    // ACT
    try {
      await config.flightSuretyApp.fundAirline({
        from: config.firstAirline,
        value: airlineRegistrationFee,
      });

      await config.flightSuretyApp.registerAirline(newAirline, airlineName, {
        from: config.firstAirline,
      });
    } catch (e) {}

    let result = await config.flightSuretyData.checkAirlineRegistered.call(
      newAirline
    );

    // ASSERT
    assert.equal(result, true, "Airline should be registered");
  });

  it("(passenger) can purchase insurance on a flight", async () => {
    // ARRANGE
    let passengerAddress = accounts[3];

    let flight = "GDH3672";
    let timeOfDeparture = Date.now();
    let timeOfArrival = Date.now();
    let timestamp = Date.now();

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

    let result = await config.flightSuretyData.getInsuree.call(
      passengerAddress
    );

    let insuranceAmount =
      await config.flightSuretyData.returnInsuranceAmount.call(
        passengerAddress,
        config.firstAirline,
        flight,
        timestamp
      );

    console.log("Insurance amount here - ", insuranceAmount);

    // ASSERT
    assert.equal(result, passengerAddress, "insuree was not created");
  });
});
