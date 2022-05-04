import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";
import Config from "./config.json";
import Web3 from "web3";
import * as Utils from "web3-utils";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );
    this.flightSuretyData = new this.web3.eth.Contract(
      FlightSuretyData.abi,
      config.dataAddress
    );
    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
  }

  initialize(callback) {
    this.web3.eth.getAccounts((error, accts) => {
      this.owner = accts[0];

      let counter = 1;

      while (this.airlines.length < 5) {
        this.airlines.push(accts[counter++]);
      }

      while (this.passengers.length < 5) {
        this.passengers.push(accts[counter++]);
      }

      this.flightSuretyData.methods
        .authorizeCaller(Config["localhost"].appAddress)
        .send({ from: accts[0] });

      callback();
    });
  }

  isOperational(callback) {
    let self = this;
    self.flightSuretyApp.methods
      .isOperational()
      .call({ from: self.owner }, callback);
  }

  fetchFlightStatus(flight, callback) {
    let self = this;
    let payload = {
      airline: this.owner,
      flight: flight,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({ from: self.owner }, (error, result) => {
        callback(error, result);
      });
  }

  buyFlightInsurance(
    airlineAddress,
    airlineName,
    flight,
    timeOfDeparture,
    timeOfArrival,
    timeStamp,
    passengerAddress,
    callback
  ) {
    console.log("airlineAddress before calling method - ", airlineAddress);

    const insuranceValue = Utils.toWei("1", "ether");

    this.flightSuretyApp.methods
      .buyFlightInsurance(
        airlineAddress,
        airlineName,
        flight,
        timeOfDeparture,
        timeOfArrival,
        timeStamp
      )
      .send(
        { from: passengerAddress, value: insuranceValue, gasLimit: 300000 },
        (error, result) => {
          console.log("result from contract.js - ", result);
          callback(error, result);
        }
      );

    this.flightSuretyData.methods
      .getInsuree(passengerAddress)
      .call((err, result) => {
        if (err) {
          console.log(err);
        } else {
          console.log("result from getInsuree - ", result);
        }
      });
  }

  returnInsuranceAmount(
    passengerAddress,
    airlineAddress,
    flight,
    timestamp,
    callback
  ) {
    this.flightSuretyData.methods
      .returnInsuranceAmount(
        passengerAddress,
        airlineAddress,
        flight,
        timestamp
      )
      .call((err, result) => {
        if (err) {
          console.log(err);
        } else {
          callback(err, result);
        }
      });
  }
}
