/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  Contract,
  ContractFactory,
  ContractTransactionResponse,
  Interface,
} from "ethers";
import type {
  Signer,
  BigNumberish,
  AddressLike,
  ContractDeployTransaction,
  ContractRunner,
} from "ethers";
import type { NonPayableOverrides } from "../common";
import type {
  StandardChainlinkFactory,
  StandardChainlinkFactoryInterface,
} from "../StandardChainlinkFactory";

const _abi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_maxTraversal",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_defaultUnlockers",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "MAX_TRAVERSAL",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "create",
    inputs: [
      {
        name: "source",
        type: "address",
        internalType: "contract IAggregatorV3Source",
      },
      {
        name: "lockWindow",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "maxAge",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "oval",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "defaultUnlockers",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setDefaultUnlockers",
    inputs: [
      {
        name: "_defaultUnlockers",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "newOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "DefaultUnlockersSet",
    inputs: [
      {
        name: "defaultUnlockers",
        type: "address[]",
        indexed: false,
        internalType: "address[]",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OvalDeployed",
    inputs: [
      {
        name: "deployer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "oval",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "lockWindow",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "maxTraversal",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "owner",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "unlockers",
        type: "address[]",
        indexed: false,
        internalType: "address[]",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
] as const;

const _bytecode =
  "0x60a06040523480156200001157600080fd5b50604051620023a8380380620023a883398101604081905262000034916200026f565b81816200004133620000b1565b60008211620000975760405162461bcd60e51b815260206004820152601960248201527f4d61782074726176657273616c206d757374206265203e20300000000000000060448201526064015b60405180910390fd5b6080829052620000a78162000101565b505050506200039e565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6200010b6200015d565b805162000120906001906020840190620001bb565b507f53dcea6cd8a9fb42c53d0155aebceb09df1f90371ee9727c244f6557223bae16816040516200015291906200034f565b60405180910390a150565b6000546001600160a01b03163314620001b95760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064016200008e565b565b82805482825590600052602060002090810192821562000213579160200282015b828111156200021357825182546001600160a01b0319166001600160a01b03909116178255602090920191600190910190620001dc565b506200022192915062000225565b5090565b5b8082111562000221576000815560010162000226565b634e487b7160e01b600052604160045260246000fd5b80516001600160a01b03811681146200026a57600080fd5b919050565b600080604083850312156200028357600080fd5b8251602080850151919350906001600160401b0380821115620002a557600080fd5b818601915086601f830112620002ba57600080fd5b815181811115620002cf57620002cf6200023c565b8060051b604051601f19603f83011681018181108582111715620002f757620002f76200023c565b6040529182528482019250838101850191898311156200031657600080fd5b938501935b828510156200033f576200032f8562000252565b845293850193928501926200031b565b8096505050505050509250929050565b6020808252825182820181905260009190848201906040850190845b81811015620003925783516001600160a01b0316835292840192918401916001016200036b565b50909695505050505050565b608051611fe1620003c76000396000818160c60152818161016201526102030152611fe16000f3fe60806040523480156200001157600080fd5b5060043610620000875760003560e01c8063715018a61162000062578063715018a6146200010e5780638da5cb5b146200011a578063a9d14058146200012c578063f2fde38b146200014357600080fd5b80635165da30146200008c5780635878157614620000c05780635c681d1e14620000f7575b600080fd5b620000a36200009d366004620004ca565b6200015a565b6040516001600160a01b0390911681526020015b60405180910390f35b620000e87f000000000000000000000000000000000000000000000000000000000000000081565b604051908152602001620000b7565b620000a36200010836600462000502565b62000257565b6200011862000282565b005b6000546001600160a01b0316620000a3565b620001186200013d36600462000544565b6200029a565b620001186200015436600462000617565b620002f6565b6000836001847f000000000000000000000000000000000000000000000000000000000000000085620001956000546001600160a01b031690565b604051620001a39062000425565b620001b49695949392919062000689565b604051809103906000f080158015620001d1573d6000803e3d6000fd5b509050826001600160a01b038216337f5e826bc8ad243559fc75cc77b0e474a2ec85df26aeb5cd6db9d9ed1740f39afa7f0000000000000000000000000000000000000000000000000000000000000000620002356000546001600160a01b031690565b60016040516200024893929190620006d5565b60405180910390a49392505050565b600181815481106200026857600080fd5b6000918252602090912001546001600160a01b0316905081565b6200028c62000379565b620002986000620003d5565b565b620002a462000379565b8051620002b990600190602084019062000433565b507f53dcea6cd8a9fb42c53d0155aebceb09df1f90371ee9727c244f6557223bae1681604051620002eb91906200070a565b60405180910390a150565b6200030062000379565b6001600160a01b0381166200036b5760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b60648201526084015b60405180910390fd5b6200037681620003d5565b50565b6000546001600160a01b03163314620002985760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604482015260640162000362565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b611852806200075a83390190565b8280548282559060005260206000209081019282156200048b579160200282015b828111156200048b57825182546001600160a01b0319166001600160a01b0390911617825560209092019160019091019062000454565b50620004999291506200049d565b5090565b5b808211156200049957600081556001016200049e565b6001600160a01b03811681146200037657600080fd5b600080600060608486031215620004e057600080fd5b8335620004ed81620004b4565b95602085013595506040909401359392505050565b6000602082840312156200051557600080fd5b5035919050565b634e487b7160e01b600052604160045260246000fd5b80356200053f81620004b4565b919050565b600060208083850312156200055857600080fd5b823567ffffffffffffffff808211156200057157600080fd5b818501915085601f8301126200058657600080fd5b8135818111156200059b576200059b6200051c565b8060051b604051601f19603f83011681018181108582111715620005c357620005c36200051c565b604052918252848201925083810185019188831115620005e257600080fd5b938501935b828510156200060b57620005fb8562000532565b84529385019392850192620005e7565b98975050505050505050565b6000602082840312156200062a57600080fd5b81356200063781620004b4565b9392505050565b6000815480845260208085019450836000528060002060005b838110156200067e5781546001600160a01b03168752958201956001918201910162000657565b509495945050505050565b600060018060a01b03808916835260c06020840152620006ad60c08401896200063e565b915086604084015285606084015284608084015280841660a084015250979650505050505050565b8381526001600160a01b038316602082015260606040820181905260009062000701908301846200063e565b95945050505050565b6020808252825182820181905260009190848201906040850190845b818110156200074d5783516001600160a01b03168352928401929184019160010162000726565b5090969550505050505056fe6101406040523480156200001257600080fd5b50604051620018523803806200185283398101604081905262000035916200049b565b601286858588866200004733620002dc565b8381116200009c5760405162461bcd60e51b815260206004820152601d60248201527f4d617820616765206e6f742061626f7665206c6f636b2077696e646f7700000060448201526064015b60405180910390fd5b60008311620000ee5760405162461bcd60e51b815260206004820152601960248201527f4d61782074726176657273616c206d757374206265203e203000000000000000604482015260640162000093565b608084905260a083905260c081905260005b82518110156200014e5762000139838281518110620001235762000123620005b4565b602002602001015160016200032c60201b60201c565b806200014581620005ca565b91505062000100565b5060405184907f7232430c38d2db810b464dc9cd004f0e41528c6ba2eb1e2e4e3220ffd3a83a1b90600090a260405183907f9955b343f0b35bf4c2045c06550a8ec2d914db72d497a1430ca3526a248f20a590600090a260405181907f6777d8e4257e9f6a86d2f91b2b9fceaeb931d8b35249fbb63203c2dc0c08187090600090a250505050806001600160a01b031660e0816001600160a01b031681525050806001600160a01b031663313ce5676040518163ffffffff1660e01b8152600401602060405180830381865afa1580156200022d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190620002539190620005f2565b60ff166101008190526040516001600160a01b038316907f023d13f58a0d1b57e2446bf7ee75c602447357846ca76f9b1dd6b982caa53b7d90600090a35060ff81166101208190526040517f4e500e16c773a18df7642e2d86cfe357eab156473b38c34df4e15dffb895072690600090a250620002d081620002dc565b5050505050506200061e565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b62000336620003fc565b6001600160a01b03821660009081526002602052604090205481151560ff909116151503620003a85760405162461bcd60e51b815260206004820152601460248201527f556e6c6f636b6572206e6f74206368616e676564000000000000000000000000604482015260640162000093565b6001600160a01b038216600081815260026020526040808220805460ff191685151590811790915590519092917f60209f49f531418079ff149eb1d71f100566dcaba03bf5a34930e08111df20c491a35050565b6000546001600160a01b03163314620004585760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604482015260640162000093565b565b6001600160a01b03811681146200047057600080fd5b50565b634e487b7160e01b600052604160045260246000fd5b805162000496816200045a565b919050565b60008060008060008060c08789031215620004b557600080fd5b8651620004c2816200045a565b602088810151919750906001600160401b0380821115620004e257600080fd5b818a0191508a601f830112620004f757600080fd5b8151818111156200050c576200050c62000473565b8060051b604051601f19603f8301168101818110858211171562000534576200053462000473565b60405291825284820192508381018501918d8311156200055357600080fd5b938501935b828510156200057c576200056c8562000489565b8452938501939285019262000558565b809a50505050505050604087015193506060870151925060808701519150620005a860a0880162000489565b90509295509295509295565b634e487b7160e01b600052603260045260246000fd5b600060018201620005eb57634e487b7160e01b600052601160045260246000fd5b5060010190565b6000602082840312156200060557600080fd5b815160ff811681146200061757600080fd5b9392505050565b60805160a05160c05160e0516101005161012051611189620006c9600039600081816102180152818161069f0152818161071a015261097f0152600081816105530152818161065801526107700152600081816101d9015281816104c6015281816105ad01528181610b610152610cf00152600081816102ac0152610c1701526000818161033a0152610401015260008181610261015281816103ce015261090b01526111896000f3fe608060405234801561001057600080fd5b506004361061014d5760003560e01c8063687043c5116100c3578063a5c38b3d1161007c578063a5c38b3d1461035e578063cb53b08d14610367578063d3fff0f61461037a578063f2fde38b1461038d578063f6e1d17a146103a0578063feaf968c146103b357600080fd5b8063687043c5146102aa578063715018a6146102d05780638205bf6a146102d85780638da5cb5b146102e05780639a6fc8f5146102f1578063a3c044761461033857600080fd5b8063313ce56711610115578063313ce5671461021357806332c6534b1461024c5780633376f53a1461025f5780633d6ba5781461028f57806350d25bcd146102a25780636666d3721461018257600080fd5b80630125554b14610152578063138623641461017a578063172b09f91461018457806324a419f4146101b75780632ef9ebba146101d4575b600080fd5b61015a6103bb565b604080519384526020840192909252908201526060015b60405180910390f35b610182610430565b005b6101a7610192366004610dfc565b60026020526000908152604090205460ff1681565b6040519015158152602001610171565b6101bf6104be565b60408051928352602083019190915201610171565b6101fb7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b039091168152602001610171565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b60405160ff9091168152602001610171565b6101a761025a366004610e17565b610582565b7f00000000000000000000000000000000000000000000000000000000000000005b604051908152602001610171565b6101bf61029d366004610e41565b6105a5565b610281610688565b7f0000000000000000000000000000000000000000000000000000000000000000610281565b6101826106cb565b6102816106dd565b6000546001600160a01b03166101fb565b6103046102ff366004610e6f565b6106f0565b604080516001600160501b03968716815260208101959095528401929092526060830152909116608082015260a001610171565b7f0000000000000000000000000000000000000000000000000000000000000000610281565b61028160015481565b61015a610375366004610e8c565b610751565b610182610388366004610eae565b6107af565b61018261039b366004610dfc565b610872565b6101bf6103ae366004610e41565b6108eb565b61030461094f565b60008060006104256103ff6001546103f07f000000000000000000000000000000000000000000000000000000000000000090565b6103fa9042610f00565b6109b7565b7f0000000000000000000000000000000000000000000000000000000000000000610751565b925092509250909192565b61043c33600154610582565b61048d5760405162461bcd60e51b815260206004820152601d60248201527f436f6e74726f6c6c657220626c6f636b65643a2063616e556e6c6f636b00000060448201526064015b60405180910390fd5b4260018190556040517f3ee2ed8fd57cf3bdf05ef91fbe207825c00ef41e2303a859c67a84cd46cd69aa90600090a2565b6000806000807f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663feaf968c6040518163ffffffff1660e01b815260040160a060405180830381865afa158015610522573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906105469190610f13565b50935050925050610579827f000000000000000000000000000000000000000000000000000000000000000060126109cf565b94909350915050565b6001600160a01b03821660009081526002602052604090205460ff165b92915050565b6000806000807f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316639a6fc8f56105e387610a40565b6040516001600160e01b031960e084901b1681526001600160501b03909116600482015260240160a060405180830381865afa158015610627573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061064b9190610f13565b5093505092505061067e827f000000000000000000000000000000000000000000000000000000000000000060126109cf565b9590945092505050565b6000806106936103bb565b505090506106c38160127f00000000000000000000000000000000000000000000000000000000000000006109cf565b91505090565b565b6106d3610aac565b6106c96000610b06565b6000806106e86103bb565b509392505050565b600080600080600080600061070d886001600160501b03166108eb565b915091508761073e8360127f00000000000000000000000000000000000000000000000000000000000000006109cf565b9099909891975087965090945092505050565b6000806000806000806107648888610b56565b925092509250610796837f000000000000000000000000000000000000000000000000000000000000000060126109cf565b95509093506001600160501b03169150505b9250925092565b6107b7610aac565b6001600160a01b03821660009081526002602052604090205481151560ff90911615150361081e5760405162461bcd60e51b8152602060048201526014602482015273155b9b1bd8dad95c881b9bdd0818da185b99d95960621b6044820152606401610484565b6001600160a01b038216600081815260026020526040808220805460ff191685151590811790915590519092917f60209f49f531418079ff149eb1d71f100566dcaba03bf5a34930e08111df20c491a35050565b61087a610aac565b6001600160a01b0381166108df5760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b6064820152608401610484565b6108e881610b06565b50565b6000806000806108fa856105a5565b91509150600061092d6001546103f07f000000000000000000000000000000000000000000000000000000000000000090565b905080821161094157509094909350915050565b506000958695509350505050565b6000806000806000806000806109636103bb565b925092509250600061097482610a40565b9050806109a38560127f00000000000000000000000000000000000000000000000000000000000000006109cf565b909a90995092975087965094509092505050565b60008183116109c657816109c8565b825b9392505050565b60008160ff168360ff16036109e55750826109c8565b8160ff168360ff161015610a19576109fd8383610f6b565b610a0890600a611068565b610a129085611077565b90506109c8565b610a238284610f6b565b610a2e90600a611068565b610a3890856110a7565b949350505050565b60006001600160501b03821115610aa85760405162461bcd60e51b815260206004820152602660248201527f53616665436173743a2076616c756520646f65736e27742066697420696e203860448201526530206269747360d01b6064820152608401610484565b5090565b6000546001600160a01b031633146106c95760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e65726044820152606401610484565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6000806000806000807f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663feaf968c6040518163ffffffff1660e01b815260040160a060405180830381865afa158015610bbd573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610be19190610f13565b5093505092509250878111610bfc57909450925090506107a8565b6000806000610c0c8b878c610c6b565b925092509250610c397f000000000000000000000000000000000000000000000000000000000000000090565b610c439042610f00565b821115610c5a57919750955093506107a892505050565b509299919850929650945050505050565b600080808080808080610c8b69ffff00000000000000008b1660016110e3565b90505b886001600160501b0316826001600160501b0316108015610cc05750806001600160501b03168a6001600160501b0316115b15610dcc5789610ccf8161110a565b604051639a6fc8f560e01b81526001600160501b0382166004820152909b507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03169150639a6fc8f59060240160a060405180830381865afa158015610d40573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610d649190610f13565b50929750909550909350506001600160501b03808616908b16148015610d8a5750600083115b610da35760008060009750975097505050505050610dd7565b8a8311610dba57509195509350909150610dd79050565b81610dc48161112d565b925050610c8e565b509195509350909150505b93509350939050565b80356001600160a01b0381168114610df757600080fd5b919050565b600060208284031215610e0e57600080fd5b6109c882610de0565b60008060408385031215610e2a57600080fd5b610e3383610de0565b946020939093013593505050565b600060208284031215610e5357600080fd5b5035919050565b6001600160501b03811681146108e857600080fd5b600060208284031215610e8157600080fd5b81356109c881610e5a565b60008060408385031215610e9f57600080fd5b50508035926020909101359150565b60008060408385031215610ec157600080fd5b610eca83610de0565b915060208301358015158114610edf57600080fd5b809150509250929050565b634e487b7160e01b600052601160045260246000fd5b8181038181111561059f5761059f610eea565b600080600080600060a08688031215610f2b57600080fd5b8551610f3681610e5a565b809550506020860151935060408601519250606086015191506080860151610f5d81610e5a565b809150509295509295909350565b60ff828116828216039081111561059f5761059f610eea565b600181815b80851115610fbf578160001904821115610fa557610fa5610eea565b80851615610fb257918102915b93841c9390800290610f89565b509250929050565b600082610fd65750600161059f565b81610fe35750600061059f565b8160018114610ff957600281146110035761101f565b600191505061059f565b60ff84111561101457611014610eea565b50506001821b61059f565b5060208310610133831016604e8410600b8410161715611042575081810a61059f565b61104c8383610f84565b806000190482111561106057611060610eea565b029392505050565b60006109c860ff841683610fc7565b80820260008212600160ff1b8414161561109357611093610eea565b818105831482151761059f5761059f610eea565b6000826110c457634e487b7160e01b600052601260045260246000fd5b600160ff1b8214600019841416156110de576110de610eea565b500590565b6001600160501b0381811683821601908082111561110357611103610eea565b5092915050565b60006001600160501b0382168061112357611123610eea565b6000190192915050565b60006001600160501b0380831681810361114957611149610eea565b600101939250505056fea26469706673582212208216491b98c1ecc221e059f95d494328ed8c71bec184d53aac216a82b7e3fe8664736f6c63430008110033a2646970667358221220cff7f06d390e1c21bd01cc495c94cd09826e90fdea328cf0a7a612aa369c343c64736f6c63430008110033";

type StandardChainlinkFactoryConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: StandardChainlinkFactoryConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class StandardChainlinkFactory__factory extends ContractFactory {
  constructor(...args: StandardChainlinkFactoryConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override getDeployTransaction(
    _maxTraversal: BigNumberish,
    _defaultUnlockers: AddressLike[],
    overrides?: NonPayableOverrides & { from?: string }
  ): Promise<ContractDeployTransaction> {
    return super.getDeployTransaction(
      _maxTraversal,
      _defaultUnlockers,
      overrides || {}
    );
  }
  override deploy(
    _maxTraversal: BigNumberish,
    _defaultUnlockers: AddressLike[],
    overrides?: NonPayableOverrides & { from?: string }
  ) {
    return super.deploy(
      _maxTraversal,
      _defaultUnlockers,
      overrides || {}
    ) as Promise<
      StandardChainlinkFactory & {
        deploymentTransaction(): ContractTransactionResponse;
      }
    >;
  }
  override connect(
    runner: ContractRunner | null
  ): StandardChainlinkFactory__factory {
    return super.connect(runner) as StandardChainlinkFactory__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): StandardChainlinkFactoryInterface {
    return new Interface(_abi) as StandardChainlinkFactoryInterface;
  }
  static connect(
    address: string,
    runner?: ContractRunner | null
  ): StandardChainlinkFactory {
    return new Contract(
      address,
      _abi,
      runner
    ) as unknown as StandardChainlinkFactory;
  }
}