"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetValidatorSlashingInfos = GetValidatorSlashingInfos;
exports.GetLatestBlock = GetLatestBlock;
exports.GetValidatorSet = GetValidatorSet;
async function GetValidatorSlashingInfos(apiUrl, consensusAddress) {
    const response = await fetch(`${apiUrl}/cosmos/slashing/v1beta1/signing_infos/${consensusAddress}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}
async function GetLatestBlock(apiUrl) {
    const response = await fetch(`${apiUrl}/cosmos/base/tendermint/v1beta1/blocks/latest`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}
async function GetValidatorSet(apiUrl) {
    const response = await fetch(`${apiUrl}/cosmos/base/tendermint/v1beta1/validatorsets/latest?pagination.limit=128`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}
