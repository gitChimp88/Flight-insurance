pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract
    bool private operational = true;

    mapping(address => address[]) private multiCalls; // used to keep track of votes in multiparty consensus

    IFlightSuretyData flightSuretyData;

    struct Flight {    
        string airlineName;   
        address airlineAddress;
        string flight;
        uint256 timestamp; 
        uint256 timeOfDeparture; 
        uint256 timeOfArrival; 
        uint8 statusCode;
        address[] insurees;
        bool hasPaidInsurance;
    }
    mapping(bytes32 => Flight) private flights;

    event InsurancePayoutAirlineAtFault(address airline, string flight, uint256 timestamp, uint8 status, uint insureeAmount);
    event InsureeWithdrawsAccountBalance(address insuree);
    event RegisterAirline(address airline);
    event InsurancePaidToPassenger(address airline, string flight, uint8 statusCode, address passenger);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
         // Modify to call data contract's status
        require(operational, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor
                                (
                                    address dataContract
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        flightSuretyData = IFlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() 
                            public 
                            returns(bool) 
    {
        return operational;  // Modify to call data contract's status
    }

    function changeOperationalStatus(bool _status)
                                external
                                requireContractOwner
    {
    
        operational = _status;
    }

    function checkIfAirlineIsRegistered(address _airlineAddress) view returns(bool)
    {
        return flightSuretyData.checkAirlineRegistered(_airlineAddress);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    
    function registerAirline
                            (  
                                address _airlineAddress,
                                string _airlineName 
                            )
                            public
                            requireIsOperational
                            returns(bool success, uint256 votes)
    {
        address callingAddress = msg.sender;

        // make a call to get registered airline counter here too.
        uint registeredAirlineCounter = flightSuretyData.getRegisteredAirlineCount();

        require(checkIfAirlineIsRegistered(_airlineAddress) == false, "Airline has already been registered");
        require(checkIfAirlineIsRegistered(callingAddress), "Caller is not a registered airline");
        require(flightSuretyData.checkAirlineContributed(callingAddress), "Airline has not made initial contribution");

        bool successVar = false;
        // when counter is at or over 5 multiparty consensus is needed
        if(registeredAirlineCounter >= 4){
            // use multiparty consensus 50% of registered airlines must approve.
            uint targetConsensus = registeredAirlineCounter / 2;

            // There should be a mapping address => address[]
            // address will be new airline array will contain airlines that voted
            // if the array length is equal to or more than target consensus then register new airline
            address[] memory arrayOfVotes = multiCalls[_airlineAddress];

            bool isDuplicate = false;
            for(uint c=0; c<arrayOfVotes.length; c++) {
                if (arrayOfVotes[c] == callingAddress) {
                    isDuplicate = true;
                    break;
                }
            }
            require(!isDuplicate, "Caller has already voted for this airline to be registered");

            // Vote is not a duplicate so we can change value
            multiCalls[_airlineAddress].push(callingAddress);
            bool votesExceedTargetConsensus = multiCalls[_airlineAddress].length >= targetConsensus;

            if(votesExceedTargetConsensus){
                //consensus has been reached we can now register airline
                flightSuretyData.registerAirline(_airlineAddress, _airlineName);
            }
            successVar = true;

        } else {
            // There are less than 4 airlines so add new airline
            flightSuretyData.registerAirline(_airlineAddress, _airlineName);
            successVar = true;
        }

        votes = multiCalls[_airlineAddress].length;
        return (successVar, votes);
    }

    function fundAirline
                                    (

                                    )
                                    external
                                    payable
    {
        flightSuretyData.fundAirline.value(msg.value)(msg.sender);
    }

    // Flight has an array of insuree addresses
    // Insurees hold insurance details in data contract when it comes to paying out
    function buyFlightInsurance 
                                (
                                    address airlineAddress,
                                    string airlineName,
                                    string flight,
                                    uint256 timeOfDeparture,
                                    uint256 timeOfArrival,
                                    uint256 timestamp
                                )
                                public
                                payable
                                requireIsOperational
                                returns(bool success)
    {
        require(msg.value == 1 ether, "Cannot purchase insurance above 1 eth");
        require(checkIfAirlineIsRegistered(airlineAddress), "Airline is not registered yet");
        bytes32 flightKey = getFlightKey(airlineAddress, flight, timestamp);
        // if flight exists then add another user to the insurance array on the flight
        if(flights[flightKey].airlineAddress == airlineAddress){
            // flight exists add insuree to array
            flights[flightKey].insurees.push(msg.sender);
        } else {
            // else create flight and add user to the array
            flights[flightKey].airlineName = airlineName;
            flights[flightKey].airlineAddress = airlineAddress;
            flights[flightKey].flight = flight;
            flights[flightKey].timestamp = timestamp;
            flights[flightKey].timeOfDeparture = timeOfDeparture;
            flights[flightKey].timeOfArrival = timeOfArrival;
            flights[flightKey].statusCode = 0;
            flights[flightKey].insurees.push(msg.sender);
            flights[flightKey].hasPaidInsurance = false;
        }

        address insureeAddress = flightSuretyData.getInsuree(msg.sender);
        if(msg.sender == insureeAddress){
            // insuree exists save data
            flightSuretyData.buyInsurance.value(msg.value)(flightKey, airlineAddress, msg.sender);
        } else {
            // insuree doesnt exist create insuree and save data
            flightSuretyData.buyInsuranceAndCreateInsuree.value(msg.value)(flightKey, airlineAddress, msg.sender);
        }   

        success = true;
        return success;
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */  
    // For airlines to register flights (implement later)
    // function registerFlight
    //                             (
    //                                 string flight
    //                             )
    //                             external
    //                             pure
    //                             requireIsOperational
    // {

    // }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus
                                (
                                    address airlineAddress,
                                    string memory flight,
                                    uint256 timestamp,
                                    uint8 statusCode
                                )
                                internal
                                requireIsOperational
                                
    {
        require(checkIfAirlineIsRegistered(airlineAddress), "Airline is not registered");

        bytes32 flightKey = getFlightKey(airlineAddress, flight, timestamp);
     
        // update flight 
        flights[flightKey].statusCode = statusCode;

        if(statusCode == STATUS_CODE_LATE_AIRLINE){
            // It's the airlines fault so provide insurance payout.
            // update insurees and airline with new account balances
            address[] memory arrayOfInsurees = flights[flightKey].insurees;
            require(flights[flightKey].hasPaidInsurance == false, "The insurance for this flight has already been paid out");

            // loop through insurees and pay them
            for(uint c=0; c<arrayOfInsurees.length; c++) {
                // call to credit insuree for each address in array.
                flightSuretyData.creditInsuree(flightKey, airlineAddress, arrayOfInsurees[c]);
                emit InsurancePaidToPassenger(airlineAddress, flight, statusCode, arrayOfInsurees[c]);
            }

            flights[flightKey].hasPaidInsurance = true;
            // maybe emit an event detailing that there has been an insurance payout and user should check their account.
            emit InsurancePayoutAirlineAtFault(airlineAddress, flight, timestamp, statusCode, arrayOfInsurees.length);
        } 
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flight,
                            uint256 timestamp                            
                        )
                        external
                        requireIsOperational
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    } 

    function withdrawInsureeAccountBalance
                                (
                                    
                                )
                                public
                                requireIsOperational
    {
        flightSuretyData.withdrawInsureeAccountBalance(msg.sender);
        // emit event that user has withdrawn their account balance.
        emit InsureeWithdrawsAccountBalance(msg.sender);
    }


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
                            requireIsOperational
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            requireIsOperational
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
                        requireIsOperational
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        internal
                        requireIsOperational
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            requireIsOperational
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            requireIsOperational
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// end region

}  

//interface
interface IFlightSuretyData {
  function registerAirline (address _airlineAddress, string _airlineName) external;
  function buyInsurance (bytes32 flightKey, address airlineAddress, address insureeAddress) external payable;
  function buyInsuranceAndCreateInsuree (bytes32 flightKey, address airlineAddress, address insureeAddress) external payable;
  function creditInsuree (bytes32 flightKey, address airlineAddress, address insureeAddress) external;
  function withdrawInsureeAccountBalance (address insureeAddress) external;
  function fundAirline (address _airlineAddress) external payable;
  function checkAirlineRegistered (address _airlineAddress) external returns(bool);
  function checkAirlineContributed (address _airlineAddress) external returns(bool);
  function getRegisteredAirlineCount () external returns(uint);
  function getInsuree (address insureeAddress) external returns(address);
}
