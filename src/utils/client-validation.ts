// Client-side validation utilities
// These functions can be used in browser environments for real-time validation

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!email.trim()) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  } else if (email.length > 255) {
    errors.push({ field: 'email', message: 'Email too long' });
  }

  return { isValid: errors.length === 0, errors };
}

// URL validation
export function validateUrl(url: string, fieldName: string = 'url'): ValidationResult {
  const errors: ValidationError[] = [];

  if (url.trim() && url !== '') {
    try {
      new URL(url);
    } catch {
      errors.push({ field: fieldName, message: 'Invalid URL format' });
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Phone validation
export function validatePhone(phone: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (phone.trim() && phone !== '') {
    const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-()]/g, ''))) {
      errors.push({ field: 'phone', message: 'Invalid phone number format' });
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Path validation (for church/county paths)
export function validatePath(path: string, fieldName: string = 'path'): ValidationResult {
  const errors: ValidationError[] = [];

  if (!path.trim()) {
    errors.push({ field: fieldName, message: 'Path is required' });
  } else if (path.length > 100) {
    errors.push({ field: fieldName, message: 'Path too long' });
  } else if (!/^[a-z0-9-]+$/.test(path)) {
    errors.push({ field: fieldName, message: 'Path must be lowercase with hyphens only' });
  } else if (path.startsWith('-') || path.endsWith('-')) {
    errors.push({ field: fieldName, message: 'Path cannot start or end with hyphen' });
  }

  return { isValid: errors.length === 0, errors };
}

// Password validation
export function validatePassword(password: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  } else if (password.length > 128) {
    errors.push({ field: 'password', message: 'Password too long' });
  }

  return { isValid: errors.length === 0, errors };
}

// Username validation
export function validateUsername(username: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!username.trim()) {
    errors.push({ field: 'username', message: 'Username is required' });
  } else if (username.length < 3) {
    errors.push({ field: 'username', message: 'Username must be at least 3 characters' });
  } else if (username.length > 50) {
    errors.push({ field: 'username', message: 'Username too long' });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push({ field: 'username', message: 'Username can only contain letters, numbers, hyphens, and underscores' });
  }

  return { isValid: errors.length === 0, errors };
}

// Coordinates validation
export function validateCoordinates(lat: string, lng: string): ValidationResult {
  const errors: ValidationError[] = [];

  if ((lat && !lng) || (!lat && lng)) {
    errors.push({ field: 'coordinates', message: 'Both latitude and longitude must be provided together' });
  } else if (lat && lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      errors.push({ field: 'latitude', message: 'Invalid latitude' });
    }

    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      errors.push({ field: 'longitude', message: 'Invalid longitude' });
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Generic text field validation
export function validateTextField(
  value: string,
  fieldName: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const { required = false, minLength = 0, maxLength = Infinity } = options;

  if (required && !value.trim()) {
    errors.push({ field: fieldName, message: `${fieldName} is required` });
  } else if (value.trim()) {
    if (value.length < minLength) {
      errors.push({ field: fieldName, message: `${fieldName} must be at least ${minLength} characters` });
    }
    if (value.length > maxLength) {
      errors.push({ field: fieldName, message: `${fieldName} too long` });
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Form validation helper
export function validateForm(
  formData: FormData,
  validators: Record<string, (value: string) => ValidationResult>
): ValidationResult {
  const allErrors: ValidationError[] = [];

  for (const [fieldName, validator] of Object.entries(validators)) {
    const value = formData.get(fieldName)?.toString() || '';
    const result = validator(value);
    allErrors.push(...result.errors);
  }

  return { isValid: allErrors.length === 0, errors: allErrors };
}

// Display validation errors in the UI
export function displayValidationErrors(
  errors: ValidationError[],
  containerSelector: string = '.validation-errors'
): void {
  const container = document.querySelector(containerSelector) as HTMLElement;
  if (!container) return;

  container.innerHTML = '';

  if (errors.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const errorList = document.createElement('ul');
  errorList.className = 'text-red-600 text-sm space-y-1';

  errors.forEach((error) => {
    const listItem = document.createElement('li');
    listItem.textContent = error.message;
    errorList.appendChild(listItem);
  });

  container.appendChild(errorList);
}

// Clear validation errors
export function clearValidationErrors(containerSelector: string = '.validation-errors'): void {
  const container = document.querySelector(containerSelector) as HTMLElement;
  if (container) {
    container.innerHTML = '';
    container.style.display = 'none';
  }
}

// Add real-time validation to a form field
export function addRealTimeValidation(
  fieldSelector: string,
  validator: (value: string) => ValidationResult,
  errorSelector?: string
): void {
  const field = document.querySelector(fieldSelector) as HTMLInputElement;
  if (!field) return;

  const errorContainer = (
    errorSelector ? document.querySelector(errorSelector) : field.parentElement?.querySelector('.field-error')
  ) as HTMLElement | null;

  const validateField = () => {
    const result = validator(field.value);

    if (errorContainer) {
      if (result.isValid) {
        errorContainer.textContent = '';
        errorContainer.style.display = 'none';
        field.classList.remove('border-red-500');
        field.classList.add('border-gray-300');
      } else {
        errorContainer.textContent = result.errors[0]?.message || '';
        errorContainer.style.display = 'block';
        field.classList.add('border-red-500');
        field.classList.remove('border-gray-300');
      }
    }
  };

  field.addEventListener('blur', validateField);
  field.addEventListener('input', () => {
    // Clear errors on input, validate on blur
    if (errorContainer) {
      errorContainer.style.display = 'none';
      field.classList.remove('border-red-500');
      field.classList.add('border-gray-300');
    }
  });
}
