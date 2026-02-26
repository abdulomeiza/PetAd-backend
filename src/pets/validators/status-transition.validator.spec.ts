import { BadRequestException } from '@nestjs/common';
import { StatusTransitionValidator } from './status-transition.validator';
import { PetStatus, UserRole } from '../../common/enums';

describe('StatusTransitionValidator', () => {
  describe('validate - Valid Transitions', () => {
    it('should allow AVAILABLE → PENDING', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.AVAILABLE,
          PetStatus.PENDING,
        ),
      ).not.toThrow();
    });

    it('should allow AVAILABLE → IN_CUSTODY', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.AVAILABLE,
          PetStatus.IN_CUSTODY,
        ),
      ).not.toThrow();
    });

    it('should allow PENDING → ADOPTED', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.PENDING,
          PetStatus.ADOPTED,
        ),
      ).not.toThrow();
    });

    it('should allow PENDING → AVAILABLE', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.PENDING,
          PetStatus.AVAILABLE,
        ),
      ).not.toThrow();
    });

    it('should allow IN_CUSTODY → AVAILABLE', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.IN_CUSTODY,
          PetStatus.AVAILABLE,
        ),
      ).not.toThrow();
    });
  });

  describe('validate - Admin-Only Transitions', () => {
    it('should allow ADMIN to change ADOPTED → AVAILABLE', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.AVAILABLE,
          UserRole.ADMIN,
        ),
      ).not.toThrow();
    });

    it('should prevent non-ADMIN from changing ADOPTED → AVAILABLE', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.AVAILABLE,
          UserRole.USER,
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.AVAILABLE,
          UserRole.SHELTER,
        ),
      ).toThrow(BadRequestException);
    });

    it('should require ADMIN role for ADOPTED transitions', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.AVAILABLE,
          UserRole.USER,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('validate - Invalid Transitions', () => {
    it('should block ADOPTED → PENDING', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.PENDING,
        ),
      ).toThrow(BadRequestException);
    });

    it('should block ADOPTED → IN_CUSTODY', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.IN_CUSTODY,
        ),
      ).toThrow(BadRequestException);
    });

    it('should block IN_CUSTODY → ADOPTED', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.IN_CUSTODY,
          PetStatus.ADOPTED,
        ),
      ).toThrow(BadRequestException);
    });

    it('should block IN_CUSTODY → PENDING', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.IN_CUSTODY,
          PetStatus.PENDING,
        ),
      ).toThrow(BadRequestException);
    });

    it('should block same status update (no-op)', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.AVAILABLE,
          PetStatus.AVAILABLE,
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.ADOPTED,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('validate - Error Messages', () => {
    it('should provide clear error message for invalid transitions', () => {
      try {
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.PENDING,
        );
        fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('ADOPTED');
          expect(error.message).toContain('PENDING');
          expect(error.message).toContain('not allowed');
        } else {
          throw error;
        }
      }
    });

    it('should provide clear error message for admin-only transitions', () => {
      try {
        StatusTransitionValidator.validate(
          PetStatus.ADOPTED,
          PetStatus.AVAILABLE,
          UserRole.USER,
        );
        fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('ADMIN');
        } else {
          throw error;
        }
      }
    });

    it('should mention same status in error for no-op', () => {
      try {
        StatusTransitionValidator.validate(
          PetStatus.PENDING,
          PetStatus.PENDING,
        );
        fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('already');
        } else {
          throw error;
        }
      }
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return correct transitions for AVAILABLE status', () => {
      const transitions = StatusTransitionValidator.getAllowedTransitions(
        PetStatus.AVAILABLE,
      );

      expect(transitions).toContain(PetStatus.PENDING);
      expect(transitions).toContain(PetStatus.IN_CUSTODY);
      expect(transitions).not.toContain(PetStatus.ADOPTED);
    });

    it('should return correct transitions for PENDING status', () => {
      const transitions = StatusTransitionValidator.getAllowedTransitions(
        PetStatus.PENDING,
      );

      expect(transitions).toContain(PetStatus.ADOPTED);
      expect(transitions).toContain(PetStatus.AVAILABLE);
    });

    it('should return correct transitions for IN_CUSTODY status', () => {
      const transitions = StatusTransitionValidator.getAllowedTransitions(
        PetStatus.IN_CUSTODY,
      );

      expect(transitions).toEqual([PetStatus.AVAILABLE]);
    });

    it('should include admin-only transitions for ADMIN role', () => {
      const transitions = StatusTransitionValidator.getAllowedTransitions(
        PetStatus.ADOPTED,
        UserRole.ADMIN,
      );

      expect(transitions).toContain(PetStatus.AVAILABLE);
    });

    it('should NOT include admin-only transitions for non-ADMIN roles', () => {
      const userTransitions = StatusTransitionValidator.getAllowedTransitions(
        PetStatus.ADOPTED,
        UserRole.USER,
      );

      expect(userTransitions).not.toContain(PetStatus.AVAILABLE);

      const shelterTransitions = StatusTransitionValidator.getAllowedTransitions(
        PetStatus.ADOPTED,
        UserRole.SHELTER,
      );

      expect(shelterTransitions).not.toContain(PetStatus.AVAILABLE);
    });

    it('should return empty array for ADOPTED status without admin role', () => {
      const transitions = StatusTransitionValidator.getAllowedTransitions(
        PetStatus.ADOPTED,
        UserRole.USER,
      );

      expect(transitions).toEqual([]);
    });
  });

  describe('isTransitionValid', () => {
    it('should return true for valid transitions', () => {
      expect(
        StatusTransitionValidator.isTransitionValid(
          PetStatus.AVAILABLE,
          PetStatus.PENDING,
        ),
      ).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(
        StatusTransitionValidator.isTransitionValid(
          PetStatus.ADOPTED,
          PetStatus.PENDING,
        ),
      ).toBe(false);
    });

    it('should return false for no-op transitions', () => {
      expect(
        StatusTransitionValidator.isTransitionValid(
          PetStatus.AVAILABLE,
          PetStatus.AVAILABLE,
        ),
      ).toBe(false);
    });

    it('should return true for admin-only transitions with ADMIN role', () => {
      expect(
        StatusTransitionValidator.isTransitionValid(
          PetStatus.ADOPTED,
          PetStatus.AVAILABLE,
          UserRole.ADMIN,
        ),
      ).toBe(true);
    });

    it('should return false for admin-only transitions without ADMIN role', () => {
      expect(
        StatusTransitionValidator.isTransitionValid(
          PetStatus.ADOPTED,
          PetStatus.AVAILABLE,
          UserRole.USER,
        ),
      ).toBe(false);
    });
  });

  describe('getTransitionInfo', () => {
    it('should return transition info for a status', () => {
      const info = StatusTransitionValidator.getTransitionInfo(
        PetStatus.AVAILABLE,
      );

      expect(info).toHaveProperty('currentStatus', PetStatus.AVAILABLE);
      expect(info).toHaveProperty('allowedTransitions');
      expect(info).toHaveProperty('adminOnlyTransitions');
      expect(info).toHaveProperty('description');
    });

    it('should include all allowed transitions', () => {
      const info = StatusTransitionValidator.getTransitionInfo(
        PetStatus.PENDING,
      );

      expect(info.allowedTransitions).toContain(PetStatus.ADOPTED);
      expect(info.allowedTransitions).toContain(PetStatus.AVAILABLE);
    });

    it('should include admin-only transitions', () => {
      const info = StatusTransitionValidator.getTransitionInfo(
        PetStatus.ADOPTED,
      );

      expect(info.adminOnlyTransitions).toContain(PetStatus.AVAILABLE);
    });

    it('should provide human-readable description', () => {
      const info = StatusTransitionValidator.getTransitionInfo(
        PetStatus.AVAILABLE,
      );

      expect(info.description).toBeTruthy();
      expect(typeof info.description).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle all PetStatus enum values', () => {
      Object.values(PetStatus).forEach((status) => {
        expect(() =>
          StatusTransitionValidator.getTransitionInfo(status as PetStatus),
        ).not.toThrow();
      });
    });

    it('should handle undefined userRole gracefully', () => {
      expect(() =>
        StatusTransitionValidator.validate(
          PetStatus.AVAILABLE,
          PetStatus.PENDING,
          undefined,
        ),
      ).not.toThrow();
    });

    it('should not allow duplicate transitions in getAllowedTransitions', () => {
      const transitions = StatusTransitionValidator.getAllowedTransitions(
        PetStatus.AVAILABLE,
        UserRole.ADMIN,
      );

      // Using Set to check for duplicates
      expect(new Set(transitions).size).toBe(transitions.length);
    });
  });
});
