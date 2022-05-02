pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    address private authorizedCaller;

    struct Airline {
        bool isRegistered;
        bool hasContributed;
        uint funds;
        string airlineName;
        address airlineAddress;
    }

    mapping(address => Airline) private registeredAirlines;
    uint private registeredAirlineCounter = 0;

    struct Insuree {
        address insureeAddress;
        uint256 fundsToWithdraw;
        
        mapping(bytes32 => uint256) flightInsuranceAmount;
    }

    mapping(address => Insuree) private insurees;


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineRegistered(address airline);

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    address _firstAirline,
                                    string _airlineName
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        // register first airline on contract deployment.
        registeredAirlines[_firstAirline] = Airline({
            isRegistered: true, 
            hasContributed: false,
            funds: 0,
            airlineName: _airlineName,
            airlineAddress: _firstAirline
        });
        registeredAirlineCounter = 1;
    }

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

    modifier checkAirlineExists(address airlineAddress)
    {
        require(registeredAirlines[airlineAddress].isRegistered == true, "Airline has not been registered yet");
        _;
    }

    modifier checkCallerAuthorized()
    {
        require(msg.sender == authorizedCaller, "Caller not authorized with this contract");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }

    function checkAirlineRegistered
                                (
                                    address _airlineAddress
                                )
                                external
                                returns (bool)
    {
        return registeredAirlines[_airlineAddress].isRegistered;
    }

    function checkAirlineContributed
                                (
                                    address _airlineAddress
                                )
                                external
                                returns (bool)
    {
        return registeredAirlines[_airlineAddress].hasContributed;
    }

    function getRegisteredAirlineCount
                                    (
                                    
                                    )
                                    external
                                    returns (uint)
    {
        return registeredAirlineCounter;
    }

    function getInsuree
                                    (
                                       address insureeAddress 
                                    )
                                    external
                                    returns (address)
    {
        return insurees[insureeAddress].insureeAddress;
    }

    function returnInsuranceAmount
                                    (
                                        address _insureeAddress,
                                        address _airline,
                                        string  _flight,
                                        uint256 _timestamp
                                    )
                                    external
                                    returns (uint256)
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _timestamp);
        return insurees[_insureeAddress].flightInsuranceAmount[flightKey];
    }

    function authorizeCaller
                            (
                                address _authorizedCaller
                            ) 
                            public
                            requireContractOwner 
    {
        authorizedCaller = _authorizedCaller;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (  
                                address _airlineAddress,
                                string _airlineName
                            )
                            external
                            checkCallerAuthorized
                            requireIsOperational
                           
    {
        // register new airline.
        registeredAirlines[_airlineAddress] = Airline({
                isRegistered: true, 
                hasContributed: false,
                funds: 0,
                airlineName: _airlineName,
                airlineAddress: _airlineAddress
        });
        registeredAirlineCounter.add(1);

        emit AirlineRegistered(_airlineAddress);
    }

    function fundAirline
                                        (
                                            address _airlineAddress
                                        )
                                        checkAirlineExists(_airlineAddress)
                                        external
                                        payable
                                        requireIsOperational
                                        checkCallerAuthorized
    {
        // maybe check here if airline exists in mapping (require statement)
        require(msg.value >= 10 ether, "Airline did not contribute enough to participate");
        registeredAirlines[_airlineAddress].hasContributed = true;
        registeredAirlines[_airlineAddress].funds.add(msg.value);
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buyInsurance
                            (  
                                bytes32 flightKey,
                                address airlineAddress,
                                address insureeAddress                           
                            )
                            external
                            payable
                            requireIsOperational
                            checkCallerAuthorized
    {
        // if insuree exists update airline funds and link flight key with amount for insuree
        registeredAirlines[airlineAddress].funds.add(msg.value);
        insurees[insureeAddress].flightInsuranceAmount[flightKey] = msg.value;
    }

    function buyInsuranceAndCreateInsuree
                            (  
                                bytes32 flightKey,
                                address airlineAddress,
                                address insureeAddress                           
                            )
                            external
                            payable
                            requireIsOperational
                            checkCallerAuthorized
    {
        // create insuree here link flight key with amount
        // and update airline funds with msg.value
        registeredAirlines[airlineAddress].funds.add(msg.value);

        insurees[insureeAddress].insureeAddress = insureeAddress;
        insurees[insureeAddress].fundsToWithdraw = 0;
        insurees[insureeAddress].flightInsuranceAmount[flightKey] = msg.value;
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsuree
                                (
                                    bytes32 flightKey,
                                    address airlineAddress,
                                    address insureeAddress
                                )
                                external
                                requireIsOperational
                                checkCallerAuthorized
                                
    {
        Insuree insuree = insurees[insureeAddress];
        uint256 insurancePayout = insurees[insureeAddress].flightInsuranceAmount[flightKey] * 2;
        Airline airline = registeredAirlines[airlineAddress];
        airline.funds.sub(insurancePayout);
        insuree.fundsToWithdraw.add(insurancePayout);
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function withdrawInsureeAccountBalance
                            (
                                address insureeAddress
                            )
                            external
                            requireIsOperational    
                            checkCallerAuthorized         
    {
        // check that the user has an account balance
        Insuree insuree = insurees[insureeAddress];
        uint fundsToWithdraw = insuree.fundsToWithdraw;
        require(fundsToWithdraw > 0, "Insuree has no funds to withdraw");
        // debit their account
        insuree.fundsToWithdraw = 0;
        // then make transfer
        insureeAddress.transfer(fundsToWithdraw);
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    // function() 
    //                         external 
    //                         payable 
    // {
    //     // create a fund function that funds the contract?
    // }


}

