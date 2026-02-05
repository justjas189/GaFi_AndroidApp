# MoneyTrack School-Wide Implementation Guide
## Role-Based Access Control (RBAC) System

**Date:** October 28, 2025  
**Version:** 2.0 - School-Wide Expansion  
**Target Users:** SHS Students, College Students, Non-Teaching Staff, Faculty

---

## 📋 Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Authentication Methods](#authentication-methods)
4. [Database Schema](#database-schema)
5. [Security Measures](#security-measures)
6. [Implementation Guide](#implementation-guide)
7. [Testing & Deployment](#testing--deployment)

---

## 1. System Architecture Overview

### Technology Stack
- **Frontend:** React Native (Expo)
- **Backend:** Supabase (PostgreSQL + Auth)
- **Authentication:** Supabase Auth with custom RBAC
- **Database:** PostgreSQL with Row Level Security (RLS)
- **AI Integration:** NVIDIA LLaMA for financial assistance

### Architecture Diagram
```
┌─────────────────────────────────────────────┐
│         React Native Mobile App             │
│  (Students, Staff, Faculty Interfaces)      │
└─────────────────┬───────────────────────────┘
                  │
                  ├── Authentication Layer
                  │   ├── School ID Validation
                  │   ├── Email/Password Auth
                  │   └── Role Assignment
                  │
                  ├── Authorization Layer
                  │   ├── Permission Checks
                  │   ├── Role-Based Access
                  │   └── Feature Gating
                  │
                  ├── Data Layer (Supabase)
                  │   ├── User Profiles
                  │   ├── Expense Tracking
                  │   ├── Budget Management
                  │   └── Analytics
                  │
                  └── Security Layer
                      ├── Row Level Security (RLS)
                      ├── Audit Logging
                      └── Data Encryption
```

---

## 2. User Roles & Permissions

### User Role Hierarchy

#### **Students**
##### A. Senior High School (SHS) Students
- **Role Code:** `student_shs`
- **Departments:** STEM, ABM, HUMSS, GAS, TVL
- **Permissions:**
  - ✅ Track personal expenses
  - ✅ Set savings goals
  - ✅ View budget analytics
  - ✅ Access AI financial assistant
  - ✅ Participate in friend leaderboards
  - ✅ View allowance tracking
  - ❌ Access faculty features
  - ❌ View school-wide analytics

##### B. College Students
- **Role Code:** `student_college`
- **Departments:** CCIS, CMET, COED, COBA
- **Permissions:**
  - All SHS student permissions, plus:
  - ✅ Generate expense reports
  - ✅ Advanced budget analytics
  - ✅ Export financial data

#### **Employees**
##### A. Non-Teaching Staff
- **Role Code:** `staff_non_teaching`
- **Departments:** Admin, Registrar, Library, Cashier, Maintenance
- **Permissions:**
  - ✅ Track work-related expenses
  - ✅ View salary information
  - ✅ Generate expense reports
  - ✅ Department-level analytics
  - ✅ Advanced budgeting tools
  - ❌ Manage other users
  - ❌ View school-wide data

##### B. Faculty Members
- **Role Code:** `faculty`
- **Departments:** CCIS, CMET, COED, COBA, SHS
- **Permissions:**
  - All staff permissions, plus:
  - ✅ Access educational resources
  - ✅ Department budget insights
  - ✅ Student financial literacy content

#### **Administrators**
##### A. System Administrator
- **Role Code:** `admin`
- **Permissions:**
  - All employee permissions, plus:
  - ✅ View all user profiles
  - ✅ Manage user accounts
  - ✅ View school-wide analytics
  - ✅ Generate reports
  - ❌ Modify system settings

##### B. Super Administrator
- **Role Code:** `super_admin`
- **Permissions:**
  - Full system access including:
  - ✅ All admin permissions
  - ✅ System configuration
  - ✅ Security settings
  - ✅ Database management

### Permission Matrix

| Feature | SHS Student | College Student | Staff | Faculty | Admin | Super Admin |
|---------|------------|-----------------|-------|---------|-------|-------------|
| Track Expenses | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Budget | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Assistant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Savings Goals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Friend Leaderboard | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View Allowance | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View Salary | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Expense Reports | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Department Analytics | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| View All Users | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| System Settings | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| School Analytics | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 3. Authentication Methods

### A. School ID Authentication (Primary)
**Recommended for all users**

**Process:**
1. User enters School ID (Student ID or Employee ID)
2. System validates ID against school registry database
3. If valid and not registered, user proceeds to registration
4. User creates password and completes profile
5. Email verification sent to school email
6. Account activated upon verification

**Benefits:**
- ✅ Ensures only legitimate school members can register
- ✅ Automatically assigns correct role and department
- ✅ Pre-fills user information
- ✅ Prevents duplicate accounts

**Implementation:**
```javascript
// Validate School ID
const result = await SchoolAuthService.validateSchoolId(schoolId);

if (result.isValid && !result.isRegistered) {
  // Proceed with registration
  await SchoolAuthService.registerWithSchoolId({
    schoolId,
    email,
    password,
    fullName: result.fullName,
    userRole: result.userType,
    department: result.department
  });
}
```

### B. Email/Password Authentication (Standard)
**Used after School ID registration**

**Process:**
1. User enters registered email and password
2. Supabase Auth validates credentials
3. System retrieves user profile and permissions
4. Session created with role-based access

**Benefits:**
- ✅ Standard authentication method
- ✅ Secure password hashing (bcrypt)
- ✅ Session management
- ✅ Password reset functionality

**Implementation:**
```javascript
const result = await SchoolAuthService.login(email, password);

if (result.success) {
  // User authenticated
  const { user, profile, permissions, session } = result;
  // Navigate to role-specific dashboard
}
```

### C. School Email Integration (Future)
**Optional OAuth integration**

**Potential Providers:**
- Google Workspace (if school uses @schoolname.edu.ph)
- Microsoft 365 (if school uses Office 365)

**Benefits:**
- ✅ Single Sign-On (SSO)
- ✅ Automatic role assignment
- ✅ No password management

---

## 4. Database Schema

### Core Tables

#### **user_profiles**
Stores comprehensive user information with role-based data.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,              -- Supabase Auth User ID
  email TEXT NOT NULL UNIQUE,        -- Login email
  full_name TEXT NOT NULL,           -- User's full name
  student_id TEXT UNIQUE,            -- For students only
  employee_id TEXT UNIQUE,           -- For staff/faculty only
  
  -- Role & Department
  user_role TEXT NOT NULL,           -- student_shs, student_college, etc.
  department TEXT,                   -- CCIS, CMET, STEM, etc.
  year_level TEXT,                   -- For students: Grade 11, 1st Year, etc.
  
  -- Financial Information
  monthly_allowance DECIMAL(10,2),   -- For students
  monthly_salary DECIMAL(10,2),      -- For employees
  
  -- Account Status
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  account_status TEXT DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

#### **user_permissions**
Stores custom permissions for individual users.

```sql
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  permission_key TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,           -- Optional expiration
  
  UNIQUE(user_id, permission_key)
);
```

#### **role_permissions**
Defines default permissions for each role.

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL,      -- Array of permission keys
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **school_id_registry**
Pre-registered school IDs for validation during registration.

```sql
CREATE TABLE school_id_registry (
  id UUID PRIMARY KEY,
  school_id TEXT NOT NULL UNIQUE,
  user_type TEXT NOT NULL,
  department TEXT,
  year_level TEXT,
  full_name TEXT NOT NULL,
  school_email TEXT,
  
  -- Registration Status
  is_registered BOOLEAN DEFAULT FALSE,
  registered_user_id UUID,
  registered_at TIMESTAMPTZ,
  
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **audit_logs**
Tracks all user actions for security and compliance.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Database Relationships

```
auth.users (Supabase)
    │
    ├─► user_profiles (1:1)
    │       │
    │       ├─► user_permissions (1:Many)
    │       ├─► expenses (1:Many)
    │       ├─► budgets (1:Many)
    │       └─► audit_logs (1:Many)
    │
    ├─► school_id_registry (1:1)
    │
    └─► role_permissions (Many:1)
```

---

## 5. Security Measures

### A. Row Level Security (RLS)
**PostgreSQL RLS ensures data isolation**

**Implementation:**
```sql
-- Users can only view their own profile
CREATE POLICY "Users view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND user_role IN ('admin', 'super_admin')
    )
  );
```

**Benefits:**
- ✅ Database-level security
- ✅ Cannot be bypassed by API
- ✅ Automatic enforcement
- ✅ Zero-trust architecture

### B. Authentication Security

#### Password Requirements
- Minimum 8 characters
- Mix of letters and numbers recommended
- Hashed using bcrypt
- Never stored in plain text

#### Session Management
- JWT tokens with expiration
- Automatic token refresh
- Secure token storage (AsyncStorage with encryption)
- Session timeout after inactivity

#### Account Protection
- Email verification required
- Failed login attempt tracking
- Account lockout after multiple failures
- Password reset via email only

### C. Authorization Checks

**Client-Side:**
```javascript
// Check permission before rendering feature
const hasPermission = await SchoolAuthService.hasPermission(
  userId,
  'view_salary'
);

if (!hasPermission) {
  // Hide feature or show access denied
  return <AccessDenied />;
}
```

**Server-Side (RLS):**
```sql
-- Automatic permission check at database level
SELECT * FROM expenses WHERE user_id = auth.uid();
-- Users can only see their own expenses
```

### D. Data Protection

#### Encryption
- All network traffic via HTTPS/TLS
- Sensitive data encrypted at rest
- API keys stored in environment variables
- Passwords hashed with bcrypt

#### Privacy
- Users control their profile visibility
- Optional friend features
- Leaderboard opt-out available
- Data export upon request

### E. Audit Logging

**All critical actions logged:**
- User registration
- Login attempts (successful/failed)
- Password changes
- Profile updates
- Permission changes
- Data exports

**Log retention:**
- Stored for 1 year minimum
- Accessible by admins only
- Used for security investigations

---

## 6. Implementation Guide

### Step 1: Database Setup

**Run the migration SQL:**
```bash
# In Supabase SQL Editor
# Paste contents of: supabase/migrations/20251028_school_wide_user_roles.sql
# Execute the migration
```

### Step 2: Populate School ID Registry

**Admin adds school IDs:**
```sql
-- Example: Add student IDs
INSERT INTO school_id_registry (
  school_id,
  user_type,
  department,
  year_level,
  full_name,
  school_email
) VALUES
  ('2024-0001', 'student_college', 'ccis', '1st Year', 'Juan Dela Cruz', 'juan.delacruz@school.edu.ph'),
  ('2024-0002', 'student_shs', 'stem', 'Grade 11', 'Maria Santos', 'maria.santos@school.edu.ph');

-- Example: Add employee IDs
INSERT INTO school_id_registry (
  school_id,
  user_type,
  department,
  full_name,
  school_email
) VALUES
  ('EMP-001', 'faculty', 'ccis', 'Prof. John Smith', 'john.smith@school.edu.ph'),
  ('EMP-002', 'staff_non_teaching', 'registrar', 'Jane Doe', 'jane.doe@school.edu.ph');
```

### Step 3: Configure Authentication

**Update Supabase settings:**
1. Go to Authentication > Settings
2. Enable email confirmations
3. Set custom email templates
4. Configure redirect URLs

### Step 4: Update React Native Code

**Import new auth service:**
```javascript
import SchoolAuthService from './src/services/SchoolAuthService';
```

**Update registration flow:**
```javascript
// Replace old SignUpScreen with SchoolRegistrationScreen
<Stack.Screen 
  name="Register" 
  component={SchoolRegistrationScreen} 
/>
```

### Step 5: Implement Permission Checks

**Wrap features with permission checks:**
```javascript
// Example: Show salary info only to employees
const { user, profile } = useAuth();

if (profile.user_role.includes('staff') || profile.user_role.includes('faculty')) {
  // Show salary tracking feature
}
```

### Step 6: Test Role-Based Features

**Create test accounts for each role:**
- SHS Student
- College Student
- Non-teaching Staff
- Faculty
- Admin

**Verify permissions work correctly:**
- Each role sees appropriate features
- Unauthorized access blocked
- Data isolation working

---

## 7. Testing & Deployment

### Testing Checklist

#### Authentication Testing
- [ ] School ID validation works
- [ ] Registration creates correct role
- [ ] Email verification required
- [ ] Login with email/password
- [ ] Session persists correctly
- [ ] Logout clears session
- [ ] Password reset functional

#### Authorization Testing
- [ ] Students see student features only
- [ ] Staff see staff features only
- [ ] Faculty see faculty features only
- [ ] Admins see all features
- [ ] Permission checks enforce correctly
- [ ] RLS policies work at database level

#### Security Testing
- [ ] Users cannot access other users' data
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Audit logs capture all actions
- [ ] Failed login attempts tracked

#### Performance Testing
- [ ] Fast login (<2 seconds)
- [ ] Quick permission checks (<100ms)
- [ ] Efficient data queries
- [ ] No N+1 query problems
- [ ] Smooth UI with many users

### Deployment Steps

1. **Backup existing database**
2. **Run migrations in production**
3. **Populate school ID registry**
4. **Update mobile app**
5. **Submit to app stores** (if needed)
6. **Monitor for issues**
7. **Collect user feedback**

### Rollback Plan

If issues occur:
1. Revert database migration
2. Deploy previous app version
3. Restore from backup if needed
4. Communicate with users

---

## 8. Support & Maintenance

### User Support

**For Students:**
- In-app help center
- FAQs about features
- Video tutorials
- Email support: support@moneytrack.edu.ph

**For Staff/Faculty:**
- Dedicated support channel
- Admin assistance
- Technical documentation
- Training sessions

### System Maintenance

**Regular Tasks:**
- Monitor audit logs weekly
- Review failed login attempts
- Update school ID registry
- Backup database daily
- Check system performance

**Monthly Tasks:**
- Security audit
- Permission review
- User feedback review
- Feature updates
- Bug fixes

---

## 9. Future Enhancements

### Planned Features
1. **OAuth Integration**
   - Google Workspace SSO
   - Microsoft 365 SSO

2. **Advanced Analytics**
   - School-wide spending trends
   - Department comparisons
   - Budget forecasting

3. **Admin Dashboard**
   - User management interface
   - System analytics
   - Report generation

4. **Mobile Biometric Auth**
   - Fingerprint login
   - Face ID support

5. **Multi-language Support**
   - English
   - Filipino
   - Department-specific terms

---

## 10. Compliance & Privacy

### Data Privacy Compliance
- **Data Privacy Act of 2012 (Philippines)**
- **GDPR principles** (if applicable)
- User consent for data collection
- Right to data export
- Right to account deletion

### School Policies
- Aligns with school data policies
- Student information protection
- Employee data confidentiality
- Audit trail for compliance

---

## Contact & Support

**Development Team:**
- Lead Developer: [Your Name]
- Email: [Your Email]
- GitHub: MoneyTrack_Test

**Thesis Advisor:**
- [Advisor Name]
- [Advisor Email]

**Technical Support:**
- Email: support@moneytrack.edu.ph
- Emergency: [Emergency Contact]

---

**Document Version:** 2.0  
**Last Updated:** October 28, 2025  
**Status:** Ready for Implementation

