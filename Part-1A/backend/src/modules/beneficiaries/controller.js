import { sendSuccess } from '../../shared/responses.js';
import { parseBeneficiaryId } from './validation.js';

export function createBeneficiaryController(service) {
  return Object.freeze({
    create: (request, response) => {
      const beneficiary = service.create(request.auth.accountId, request.body);
      sendSuccess(response, 201, 'Beneficiary profile created.', beneficiary);
    },
    list: (request, response) => {
      const beneficiaries = service.list(request.auth.accountId);
      sendSuccess(response, 200, 'Beneficiary profiles retrieved.', beneficiaries);
    },
    getProfile: (request, response) => {
      const beneficiaryId = parseBeneficiaryId(request.params.beneficiaryId);
      const beneficiary = service.getProfile(request.auth.accountId, beneficiaryId);
      sendSuccess(response, 200, 'Beneficiary profile retrieved.', beneficiary);
    },
    getAuthorizationStatus: (request, response) => {
      const beneficiaryId = parseBeneficiaryId(request.params.beneficiaryId);
      const status = service.getAuthorizationStatus(request.auth.accountId, beneficiaryId);
      sendSuccess(response, 200, 'Beneficiary authorization status retrieved.', status);
    },
    update: (request, response) => {
      const beneficiaryId = parseBeneficiaryId(request.params.beneficiaryId);
      const beneficiary = service.update(
        request.auth.accountId,
        beneficiaryId,
        request.body,
      );
      sendSuccess(response, 200, 'Beneficiary profile updated.', beneficiary);
    },
    reviewAuthorization: (request, response) => {
      const beneficiaryId = parseBeneficiaryId(request.params.beneficiaryId);
      const decision = service.reviewAuthorization(
        request.auth,
        beneficiaryId,
        request.body,
      );
      sendSuccess(response, 200, 'Beneficiary authorization reviewed.', decision);
    },
  });
}
