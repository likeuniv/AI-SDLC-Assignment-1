import {
  beneficiaryNotAuthorized,
  beneficiaryStateConflict,
  forbidden,
  resourceNotFound,
} from '../../shared/errors.js';
import { createTimeService } from '../../shared/time.js';
import { createBeneficiaryRepository } from './repository.js';
import {
  rejectProtectedBeneficiaryFields,
  validateAuthorizationDecision,
  validateBeneficiaryProfile,
} from './validation.js';

const REVIEW_PERMISSION = 'beneficiary:review-authorization';

function publicProfile(beneficiary) {
  const {
    id,
    fullName,
    dateOfBirth,
    relationship,
    relationshipDescription,
    gender,
    contactEmail,
    contactPhone,
    authorizationStatus,
    createdAt,
    updatedAt,
  } = beneficiary;
  return {
    id,
    fullName,
    dateOfBirth,
    relationship,
    relationshipDescription,
    gender,
    contactEmail,
    contactPhone,
    authorizationStatus,
    createdAt,
    updatedAt,
  };
}

function statusOnly(beneficiary) {
  return {
    beneficiaryId: beneficiary.id,
    authorizationStatus: beneficiary.authorizationStatus,
  };
}

export function createBeneficiaryService(database, config) {
  const repository = createBeneficiaryRepository(database);
  const time = createTimeService({ timeZone: config.hospitalTimeZone, now: config.now });

  function isAdult(beneficiary) {
    return time.ageOnDate(beneficiary.dateOfBirth) >= 18;
  }

  function refreshAuthorizationState(beneficiary) {
    if (isAdult(beneficiary) && beneficiary.authorizationStatus === null) {
      repository.markPending.run(time.now().toISOString(), beneficiary.id);
      return repository.findById.get(beneficiary.id);
    }
    return beneficiary;
  }

  function assertProtectedAccess(beneficiary) {
    if (
      isAdult(beneficiary)
      && beneficiary.authorizationStatus !== 'AUTHORIZED'
    ) {
      throw beneficiaryNotAuthorized();
    }
  }

  function getOwned(beneficiaryId, ownerAccountId) {
    const beneficiary = repository.findOwnedById.get(beneficiaryId, ownerAccountId);
    if (!beneficiary) {
      throw resourceNotFound();
    }
    return refreshAuthorizationState(beneficiary);
  }

  return Object.freeze({
    create(ownerAccountId, body) {
      const values = validateBeneficiaryProfile(body, {
        hospitalLocalDate: time.hospitalLocalDate(),
      });
      const now = time.now().toISOString();
      const authorizationStatus = time.ageOnDate(values.dateOfBirth) >= 18
        ? 'PENDING_AUTHORIZATION'
        : null;
      const beneficiaryId = repository.insert.run(
        ownerAccountId,
        values.fullName,
        values.dateOfBirth,
        values.relationship,
        values.relationshipDescription,
        values.gender,
        values.contactEmail,
        values.contactPhone,
        authorizationStatus,
        now,
        now,
      ).lastInsertRowid;
      const beneficiary = repository.findById.get(beneficiaryId);
      return authorizationStatus === 'PENDING_AUTHORIZATION'
        ? statusOnly(beneficiary)
        : publicProfile(beneficiary);
    },
    list(ownerAccountId) {
      return repository.withWriteTransaction(() => repository.listOwned
        .all(ownerAccountId)
        .map((row) => {
          const beneficiary = refreshAuthorizationState(row);
          if (
            isAdult(beneficiary)
            && beneficiary.authorizationStatus !== 'AUTHORIZED'
          ) {
            return statusOnly(beneficiary);
          }
          return publicProfile(beneficiary);
        }))();
    },
    getProfile(ownerAccountId, beneficiaryId) {
      return repository.withWriteTransaction(() => {
        const beneficiary = getOwned(beneficiaryId, ownerAccountId);
        assertProtectedAccess(beneficiary);
        return publicProfile(beneficiary);
      })();
    },
    getAuthorizationStatus(ownerAccountId, beneficiaryId) {
      return repository.withWriteTransaction(() => {
        const beneficiary = getOwned(beneficiaryId, ownerAccountId);
        return statusOnly(beneficiary);
      })();
    },
    update(ownerAccountId, beneficiaryId, body) {
      return repository.withWriteTransaction(() => {
        const current = getOwned(beneficiaryId, ownerAccountId);
        rejectProtectedBeneficiaryFields(body);
        assertProtectedAccess(current);
        const values = validateBeneficiaryProfile(body, {
          hospitalLocalDate: time.hospitalLocalDate(),
          current,
          partial: true,
        });
        const updatedAt = time.now().toISOString();
        if (!repository.updateProfile.run(
          values.fullName,
          values.dateOfBirth,
          values.relationship,
          values.relationshipDescription,
          values.gender,
          values.contactEmail,
          values.contactPhone,
          updatedAt,
          beneficiaryId,
          ownerAccountId,
        ).changes) {
          throw resourceNotFound();
        }
        return publicProfile(repository.findOwnedById.get(beneficiaryId, ownerAccountId));
      })();
    },
    reviewAuthorization(actor, beneficiaryId, body) {
      if (actor.role !== 'STAFF' || !config.hasPermission(actor.accountId, REVIEW_PERMISSION)) {
        throw forbidden();
      }
      const { outcome, verificationMethod } = validateAuthorizationDecision(body);
      return repository.withWriteTransaction(() => {
        const beneficiary = repository.findById.get(beneficiaryId);
        if (!beneficiary) {
          throw resourceNotFound();
        }
        const current = refreshAuthorizationState(beneficiary);
        if (!isAdult(current) || current.authorizationStatus !== 'PENDING_AUTHORIZATION') {
          throw beneficiaryStateConflict();
        }

        const reviewedAt = time.now().toISOString();
        if (!repository.updateDecisionState.run(
          outcome,
          reviewedAt,
          beneficiaryId,
        ).changes) {
          throw beneficiaryStateConflict();
        }
        repository.insertAudit.run(
          beneficiaryId,
          actor.accountId,
          verificationMethod,
          outcome,
          reviewedAt,
        );
        return { beneficiaryId, authorizationStatus: outcome };
      })();
    },
  });
}
