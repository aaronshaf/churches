import { FC } from 'hono/jsx';
import { formClass, formGroupClass, labelClass, inputClass, buttonClass, errorClass } from '../styles/forms';

type LoginFormProps = {
  error?: string;
};

export const LoginForm: FC<LoginFormProps> = ({ error }) => {
  return (
    <form method="POST" class={formClass}>
      <h2 style="text-align: center; margin-bottom: 2rem; font-size: 1.5rem; font-weight: 600;">Login</h2>
      
      {error && (
        <p class={errorClass} style="margin-bottom: 1rem; text-align: center;">
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
          autocomplete="username"
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="password" class={labelClass}>Password</label>
        <input
          type="password"
          id="password"
          name="password"
          required
          class={inputClass}
          autocomplete="current-password"
        />
      </div>
      
      <button type="submit" class={buttonClass}>
        Sign In
      </button>
    </form>
  );
};