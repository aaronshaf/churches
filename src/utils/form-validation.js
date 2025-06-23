// Client-side form validation script
// This can be included in HTML pages for real-time validation

(() => {
  // Validation functions
  const validators = {
    email: (value) => {
      if (!value.trim()) return { valid: false, message: 'Email is required' };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { valid: false, message: 'Invalid email format' };
      if (value.length > 255) return { valid: false, message: 'Email too long' };
      return { valid: true };
    },

    url: (value) => {
      if (!value.trim()) return { valid: true }; // Optional field
      try {
        new URL(value);
        return { valid: true };
      } catch {
        return { valid: false, message: 'Invalid URL format' };
      }
    },

    phone: (value) => {
      if (!value.trim()) return { valid: true }; // Optional field
      const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(value.replace(/[\s\-()]/g, ''))) {
        return { valid: false, message: 'Invalid phone number format' };
      }
      return { valid: true };
    },

    path: (value) => {
      if (!value.trim()) return { valid: false, message: 'Path is required' };
      if (value.length > 100) return { valid: false, message: 'Path too long' };
      if (!/^[a-z0-9-]+$/.test(value)) return { valid: false, message: 'Path must be lowercase with hyphens only' };
      if (value.startsWith('-') || value.endsWith('-'))
        return { valid: false, message: 'Path cannot start or end with hyphen' };
      return { valid: true };
    },

    password: (value) => {
      if (!value) return { valid: false, message: 'Password is required' };
      if (value.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
      if (value.length > 128) return { valid: false, message: 'Password too long' };
      return { valid: true };
    },

    username: (value) => {
      if (!value.trim()) return { valid: false, message: 'Username is required' };
      if (value.length < 3) return { valid: false, message: 'Username must be at least 3 characters' };
      if (value.length > 50) return { valid: false, message: 'Username too long' };
      if (!/^[a-zA-Z0-9_-]+$/.test(value))
        return { valid: false, message: 'Username can only contain letters, numbers, hyphens, and underscores' };
      return { valid: true };
    },

    required: (value) => {
      if (!value.trim()) return { valid: false, message: 'This field is required' };
      return { valid: true };
    },

    maxLength: (maxLen) => (value) => {
      if (value.length > maxLen) return { valid: false, message: `Too long (max ${maxLen} characters)` };
      return { valid: true };
    },
  };

  // Show/hide error message
  function showError(field, message) {
    let errorDiv = field.parentElement.querySelector('.field-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'field-error text-red-600 text-sm mt-1';
      field.parentElement.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    field.classList.add('border-red-500');
    field.classList.remove('border-gray-300');
  }

  function hideError(field) {
    const errorDiv = field.parentElement.querySelector('.field-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
    field.classList.remove('border-red-500');
    field.classList.add('border-gray-300');
  }

  // Validate a single field
  function validateField(field) {
    const validationType = field.dataset.validate;
    if (!validationType) return true;

    const validator = validators[validationType];
    if (!validator) return true;

    const result = validator(field.value);
    if (result.valid) {
      hideError(field);
      return true;
    } else {
      showError(field, result.message);
      return false;
    }
  }

  // Validate coordinates together
  function validateCoordinates() {
    const latField = document.querySelector('[name="latitude"]');
    const lngField = document.querySelector('[name="longitude"]');

    if (!latField || !lngField) return true;

    const lat = latField.value.trim();
    const lng = lngField.value.trim();

    // Clear previous errors
    hideError(latField);
    hideError(lngField);

    if ((lat && !lng) || (!lat && lng)) {
      const message = 'Both latitude and longitude must be provided together';
      if (lat && !lng) showError(lngField, message);
      if (!lat && lng) showError(latField, message);
      return false;
    }

    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      let valid = true;

      if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
        showError(latField, 'Invalid latitude (-90 to 90)');
        valid = false;
      }

      if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
        showError(lngField, 'Invalid longitude (-180 to 180)');
        valid = false;
      }

      return valid;
    }

    return true;
  }

  // Initialize validation when DOM is ready
  function initValidation() {
    // Add validation to fields with data-validate attribute
    document.querySelectorAll('[data-validate]').forEach((field) => {
      // Validate on blur
      field.addEventListener('blur', () => validateField(field));

      // Clear errors on input
      field.addEventListener('input', () => hideError(field));
    });

    // Special handling for coordinate fields
    const latField = document.querySelector('[name="latitude"]');
    const lngField = document.querySelector('[name="longitude"]');

    if (latField && lngField) {
      [latField, lngField].forEach((field) => {
        field.addEventListener('blur', validateCoordinates);
        field.addEventListener('input', () => {
          hideError(latField);
          hideError(lngField);
        });
      });
    }

    // Validate entire form on submit
    document.querySelectorAll('form[data-validate-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        let isValid = true;

        // Validate all fields with validation
        form.querySelectorAll('[data-validate]').forEach((field) => {
          if (!validateField(field)) {
            isValid = false;
          }
        });

        // Validate coordinates
        if (!validateCoordinates()) {
          isValid = false;
        }

        if (!isValid) {
          e.preventDefault();
          // Scroll to first error
          const firstError = form.querySelector('.field-error[style*="block"]');
          if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initValidation);
  } else {
    initValidation();
  }

  // Expose validators globally for custom use
  window.FormValidation = {
    validators: validators,
    validateField: validateField,
    showError: showError,
    hideError: hideError,
  };
})();
