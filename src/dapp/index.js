import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

(async () => {
  let result = null;

  let contract = new Contract("localhost", () => {
    // Read transaction
    contract.isOperational((error, result) => {
      console.log(error, result);
      display("Operational Status", "Check if contract is operational", [
        { label: "Operational Status", error: error, value: result },
      ]);
    });

    function eventListener(err, contractEvent) {
      if (err) {
        console.error("event listener error", err);
        return;
      }
      console.log("Heard something!");
      const { event, returnValues, blockNumber } = contractEvent;
    }

    function listenToEvents(fromBlockNumber) {
      console.log("Listening for honks");
      contract.flightSuretyApp.events.InsurancePayoutAirlineAtFault(
        {
          fromBlock: fromBlockNumber || 0,
        },
        eventListener
      );
    }

    listenToEvents(0);

    // User-submitted transaction
    DOM.elid("submit-oracle").addEventListener("click", () => {
      let flight = DOM.elid("flight-number").value;
      // Write transaction
      contract.fetchFlightStatus(flight, (error, result) => {
        console.log("result from fetch flight status - ", result);
        display("Oracles", "Trigger oracles", [
          {
            label: "Fetch Flight Status",
            error: error,
            value: result.flight + " " + result.timestamp,
          },
        ]);
      });
    });

    DOM.elid("list-of-flights").addEventListener("change", () => {
      let flightPicked = DOM.elid("list-of-flights").value;
      // Populate DOM with correct information
      const flightDetails = [
        {
          flightNumber: "V239",
          airline: "Fake-jet",
          departure: Date.now(),
          arrival: Date.now(),
        },
        {
          flightNumber: "D898",
          airline: "Real-jet",
          departure: Date.now(),
          arrival: Date.now(),
        },
        {
          flightNumber: "F437",
          airline: "Bake-jet",
          departure: Date.now(),
          arrival: Date.now(),
        },
        {
          flightNumber: "H090",
          airline: "Teal-jet",
          departure: Date.now(),
          arrival: Date.now(),
        },
      ];

      const flight = flightDetails.find((val) => {
        return val.flightNumber === flightPicked;
      });

      let element1 = DOM.elid("flight-details-number");
      let element2 = DOM.elid("flight-details-airline");
      let element3 = DOM.elid("flight-details-departure");
      let element4 = DOM.elid("flight-details-arrival");
      DOM.removeText(element1);
      DOM.removeText(element2);
      DOM.removeText(element3);
      DOM.removeText(element4);

      DOM.appendText(element1, flight.flightNumber);
      DOM.appendText(element2, flight.airline);
      DOM.appendText(element3, flight.departure);
      DOM.appendText(element4, flight.arrival);
    });

    DOM.elid("buy-insurance-button").addEventListener("click", () => {
      // Write transaction
      const flightPicked = DOM.elid("list-of-flights").value;
      const passengerAddress = contract.owner;
      const airlines = contract.airlines;
      const timeStamp = Date.now();

      // maybe put this inside contract code so it can be accessed above and theres no duplication
      const flightDetails = [
        {
          flightNumber: "V239",
          airline: "Fake-jet",
          departure: Date.now(),
          arrival: Date.now(),
          address: airlines[0],
        },
        {
          flightNumber: "D898",
          airline: "Real-jet",
          departure: Date.now(),
          arrival: Date.now(),
          address: airlines[1],
        },
        {
          flightNumber: "F437",
          airline: "Bake-jet",
          departure: Date.now(),
          arrival: Date.now(),
          address: airlines[2],
        },
        {
          flightNumber: "H090",
          airline: "Teal-jet",
          departure: Date.now(),
          arrival: Date.now(),
          address: airlines[3],
        },
      ];

      const flight = flightDetails.find((val) => {
        return val.flightNumber === flightPicked;
      });

      let firstAirline = contract.owner;

      contract.buyFlightInsurance(
        firstAirline,
        flight.airline,
        flight.flightNumber,
        flight.departure,
        flight.arrival,
        timeStamp,
        passengerAddress,
        (error, result) => {
          // display something here
          // maybe we have an event attached to buying flight insurance?
          if (error) {
            console.log(error);
          }
          console.log("result from buyFlightInsurance - ", result);
          // if result then display confirmation.
        }
      );

      contract.returnInsuranceAmount(
        passengerAddress,
        firstAirline,
        flight.flightNumber,
        timeStamp,
        (error, result) => {
          if (error) {
            console.log(error);
          }
          console.log("result from call for insurance amount - ", result);
        }
      );
    });
  });
})();

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(
      DOM.div(
        { className: "col-sm-8 field-value" },
        result.error ? String(result.error) : String(result.value)
      )
    );
    section.appendChild(row);
  });
  displayDiv.append(section);
}
