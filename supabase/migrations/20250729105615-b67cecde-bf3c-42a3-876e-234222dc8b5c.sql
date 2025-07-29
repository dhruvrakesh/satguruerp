-- Check what roles are allowed by looking at the constraint
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
AND conname LIKE '%role%';

-- Also check if there's an enum type for roles
SELECT enumlabel FROM pg_enum WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'user_role'
);

-- Update the check constraint to include general_manager if it exists
-- First let's see the current constraint
\d+ profiles;