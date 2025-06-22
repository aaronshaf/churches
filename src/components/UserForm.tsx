import { FC } from 'hono/jsx';
import { formGroupClass, labelClass, inputClass, buttonClass, errorClass } from '../styles/forms';

type UserFormProps = {
  action: string;
  user?: any;
  error?: string;
  isNew?: boolean;
  isOnlyAdmin?: boolean;
};

export const UserForm: FC<UserFormProps> = ({ action, user, error, isNew = false, isOnlyAdmin = false }) => {
  return (
    <form method="POST" action={action}>
      <h2 style="margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 600;">
        {isNew ? 'Create New User' : 'Edit User'}
      </h2>
      
      {error && (
        <p class={errorClass} style="margin-bottom: 1rem;">
          {error}
        </p>
      )}
      
      <div class={formGroupClass}>
        <label for="username" class={labelClass}>Username</label>
        <input
          type="text"
          id="username"
          name="username"
          required
          class={inputClass}
          value={user?.username || ''}
          disabled={!isNew}
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="email" class={labelClass}>Email</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          class={inputClass}
          value={user?.email || ''}
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="password" class={labelClass}>
          Password {isNew ? '' : '(leave blank to keep current)'}
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required={isNew}
          class={inputClass}
          minlength="6"
          placeholder={isNew ? '' : 'Leave blank to keep current password'}
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="userType" class={labelClass}>
          User Type
          {isOnlyAdmin && ' (Cannot change - only admin user)'}
        </label>
        <select
          id="userType"
          name="userType"
          required
          class={inputClass}
          disabled={isOnlyAdmin}
        >
          <option value="contributor" selected={user?.userType === 'contributor' || (!user && !isNew)}>Contributor</option>
          <option value="admin" selected={user?.userType === 'admin'}>Admin</option>
        </select>
        {isOnlyAdmin && (
          <input type="hidden" name="userType" value="admin" />
        )}
      </div>
      
      <div style="display: flex; gap: 1rem;">
        <button type="submit" class={buttonClass}>
          {isNew ? 'Create User' : 'Update User'}
        </button>
        <a href="/admin/users" class={buttonClass} style="background-color: #6b7280; text-align: center; text-decoration: none;">
          Cancel
        </a>
      </div>
    </form>
  );
};