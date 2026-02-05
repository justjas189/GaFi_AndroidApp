// src/services/SchoolAuthService.js
// School-Wide Authentication Service with Role-Based Access Control
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugUtils from '../utils/DebugUtils';

class SchoolAuthService {
  /**
   * Validate School ID before registration
   * @param {string} schoolId - Student ID or Employee ID
   * @returns {Promise<Object>} Validation result
   */
  static async validateSchoolId(schoolId) {
    try {
      DebugUtils.log('SCHOOL_AUTH', 'Validating school ID', { schoolId });

      const { data, error } = await supabase.rpc('validate_school_id', {
        school_id_param: schoolId
      });

      if (error) throw error;

      DebugUtils.log('SCHOOL_AUTH', 'School ID validation result', data);
      return {
        success: true,
        isValid: data.is_valid,
        isRegistered: data.is_registered,
        userType: data.user_type,
        department: data.department,
        fullName: data.full_name
      };
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'School ID validation failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Register new user with school ID validation
   * @param {Object} registrationData - User registration data
   * @returns {Promise<Object>} Registration result
   */
  static async registerWithSchoolId(registrationData) {
    const {
      email,
      password,
      schoolId,
      fullName,
      userRole,
      department,
      yearLevel,
      contactNumber
    } = registrationData;

    try {
      DebugUtils.log('SCHOOL_AUTH', 'Starting school registration', { email, schoolId, userRole });

      // Step 1: Validate school ID
      const validation = await this.validateSchoolId(schoolId);
      
      if (!validation.success || !validation.isValid) {
        throw new Error('Invalid school ID. Please contact the registrar\'s office.');
      }

      if (validation.isRegistered) {
        throw new Error('This school ID is already registered. Please use "Forgot Password" if you need to recover your account.');
      }

      // Step 2: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            school_id: schoolId,
            user_role: userRole
          }
        }
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Step 3: Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email,
          full_name: fullName,
          student_id: userRole.includes('student') ? schoolId : null,
          employee_id: userRole.includes('staff') || userRole.includes('faculty') ? schoolId : null,
          user_role: userRole,
          department,
          year_level: yearLevel,
          contact_number: contactNumber,
          account_status: 'pending', // Requires verification
          is_verified: false
        });

      if (profileError) throw profileError;

      // Step 4: Update school ID registry
      await supabase
        .from('school_id_registry')
        .update({
          is_registered: true,
          registered_user_id: userId,
          registered_at: new Date().toISOString()
        })
        .eq('school_id', schoolId);

      // Step 5: Log audit event
      await this.logAuditEvent(userId, 'USER_REGISTERED', 'user_profiles', userId, {
        school_id: schoolId,
        user_role: userRole,
        department
      });

      DebugUtils.log('SCHOOL_AUTH', 'Registration successful', { userId, email });

      return {
        success: true,
        user: authData.user,
        message: 'Registration successful! Please check your school email for verification.'
      };
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Registration failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Login with school email or personal email
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Login result
   */
  static async login(email, password) {
    try {
      DebugUtils.log('SCHOOL_AUTH', 'Login attempt', { email });

      // Step 1: Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Step 2: Get user profile with permissions
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Step 3: Check account status
      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('Your account has been deactivated. Please contact the administrator.');
      }

      if (profile.account_status === 'suspended') {
        await supabase.auth.signOut();
        throw new Error('Your account has been suspended. Please contact the administrator.');
      }

      // Step 4: Get user permissions
      const { data: permissions } = await supabase.rpc('get_user_permissions', {
        user_id_param: userId
      });

      // Step 5: Update last login
      await supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);

      // Step 6: Store user data locally
      await AsyncStorage.setItem('userRole', profile.user_role);
      await AsyncStorage.setItem('userPermissions', JSON.stringify(permissions || []));
      await AsyncStorage.setItem('userDepartment', profile.department || '');

      // Step 7: Log audit event
      await this.logAuditEvent(userId, 'USER_LOGIN', 'auth', userId);

      DebugUtils.log('SCHOOL_AUTH', 'Login successful', { 
        userId, 
        role: profile.user_role,
        permissions: permissions?.length || 0
      });

      return {
        success: true,
        user: authData.user,
        profile,
        permissions: permissions || [],
        session: authData.session
      };
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Login failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if user has specific permission
   * @param {string} userId - User ID
   * @param {string} permission - Permission key
   * @returns {Promise<boolean>} Has permission
   */
  static async hasPermission(userId, permission) {
    try {
      const { data, error } = await supabase.rpc('user_has_permission', {
        user_id_param: userId,
        permission_key_param: permission
      });

      if (error) throw error;
      return data;
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Permission check failed', error);
      return false;
    }
  }

  /**
   * Get user permissions from cache or server
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User permissions
   */
  static async getUserPermissions(userId) {
    try {
      // Try cache first
      const cached = await AsyncStorage.getItem('userPermissions');
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from server
      const { data, error } = await supabase.rpc('get_user_permissions', {
        user_id_param: userId
      });

      if (error) throw error;

      // Cache for future use
      await AsyncStorage.setItem('userPermissions', JSON.stringify(data || []));
      return data || [];
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Get permissions failed', error);
      return [];
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Update result
   */
  static async updateProfile(userId, updates) {
    try {
      DebugUtils.log('SCHOOL_AUTH', 'Updating profile', { userId, fields: Object.keys(updates) });

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await this.logAuditEvent(userId, 'PROFILE_UPDATED', 'user_profiles', userId, {
        updated_fields: Object.keys(updates)
      });

      DebugUtils.log('SCHOOL_AUTH', 'Profile updated successfully', { userId });

      return {
        success: true,
        profile: data
      };
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Profile update failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Request account verification
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Verification request result
   */
  static async requestVerification(userId) {
    try {
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const { error } = await supabase
        .from('user_profiles')
        .update({
          verification_code: verificationCode,
          verification_expires_at: expiresAt.toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      // In production, send verification email here
      // For now, return the code (remove in production!)
      DebugUtils.log('SCHOOL_AUTH', 'Verification requested', { userId, code: verificationCode });

      return {
        success: true,
        message: 'Verification code sent to your school email',
        // Remove this in production!
        code: verificationCode
      };
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Verification request failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify account with code
   * @param {string} userId - User ID
   * @param {string} code - Verification code
   * @returns {Promise<Object>} Verification result
   */
  static async verifyAccount(userId, code) {
    try {
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('verification_code, verification_expires_at')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      // Check if code matches and hasn't expired
      if (profile.verification_code !== code) {
        throw new Error('Invalid verification code');
      }

      if (new Date(profile.verification_expires_at) < new Date()) {
        throw new Error('Verification code has expired');
      }

      // Mark as verified
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          account_status: 'active',
          verification_code: null,
          verification_expires_at: null
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log audit event
      await this.logAuditEvent(userId, 'ACCOUNT_VERIFIED', 'user_profiles', userId);

      return {
        success: true,
        message: 'Account verified successfully!'
      };
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Verification failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Log audit event
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource ID
   * @param {Object} details - Additional details
   */
  static async logAuditEvent(userId, action, resourceType = null, resourceId = null, details = null) {
    try {
      await supabase.rpc('log_audit_event', {
        user_id_param: userId,
        action_param: action,
        resource_type_param: resourceType,
        resource_id_param: resourceId,
        details_param: details
      });
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Audit log failed', error);
    }
  }

  /**
   * Get user role from cache
   * @returns {Promise<string|null>} User role
   */
  static async getCachedUserRole() {
    try {
      return await AsyncStorage.getItem('userRole');
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear user session data
   */
  static async clearSession() {
    try {
      await AsyncStorage.multiRemove([
        'userRole',
        'userPermissions',
        'userDepartment'
      ]);
      await supabase.auth.signOut();
    } catch (error) {
      DebugUtils.error('SCHOOL_AUTH', 'Clear session failed', error);
    }
  }
}

export default SchoolAuthService;