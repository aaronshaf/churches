import type { FC } from 'hono/jsx';

export const ChurchFormScript: FC = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
        // Global functions for gathering management
        window.addGathering = function() {
          const container = document.getElementById('gatherings-container');
          const gatherings = container.querySelectorAll('.gathering-item');
          const index = gatherings.length;
          
          const newGathering = document.createElement('div');
          newGathering.className = 'border border-gray-200 rounded-lg p-4 gathering-item';
          newGathering.innerHTML = \`
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label class="block text-sm font-medium text-gray-700">Day</label>
                <select name="gathering_day_\${index}" class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6">
                  <option value="">Select Day</option>
                  <option value="Sunday">Sunday</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Time</label>
                <input type="time" name="gathering_time_\${index}" class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Type</label>
                <input type="text" name="gathering_type_\${index}" placeholder="e.g., Worship Service, Bible Study" class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6" />
              </div>
            </div>
            <div class="mt-3">
              <label class="block text-sm font-medium text-gray-700">Notes</label>
              <textarea name="gathering_notes_\${index}" rows="2" class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6" placeholder="Additional notes about this gathering"></textarea>
            </div>
            <div class="mt-2">
              <button type="button" onclick="removeGathering(this)" class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                Remove
              </button>
            </div>
          \`;
          
          container.appendChild(newGathering);
        };

        window.removeGathering = function(button) {
          const gatheringItem = button.closest('.gathering-item');
          gatheringItem.remove();
        };

        // Form submission handler
        function handleFormSubmit(event) {
          const submitButton = document.getElementById('submit-button');
          const buttonText = submitButton.querySelector('.button-text');
          const buttonSpinner = submitButton.querySelector('.button-spinner');
          
          buttonText.classList.add('hidden');
          buttonSpinner.classList.remove('hidden');
          submitButton.disabled = true;
        }

        // Address validation and geocoding
        async function getCoordinates() {
          const addressField = document.getElementById('address');
          const latField = document.getElementById('latitude');
          const lngField = document.getElementById('longitude');
          const button = document.getElementById('geocode-button');
          const buttonText = document.getElementById('geocode-button-text');
          const messageDiv = document.getElementById('geocode-message');
          
          const address = addressField?.value?.trim();
          
          if (!address) {
            showGeocodeMessage('Please enter an address first', 'error');
            return;
          }
          
          button.disabled = true;
          buttonText.textContent = 'Validating address...';
          messageDiv.className = 'mt-2 hidden';
          
          try {
            const response = await fetch('/api/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: address })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              if (latField) latField.value = data.latitude;
              if (lngField) lngField.value = data.longitude;
              handleAddressValidation(data, addressField);
            } else {
              showGeocodeMessage(data.error || 'Failed to get coordinates', 'error');
            }
          } catch (error) {
            console.error('Address validation error:', error);
            showGeocodeMessage('Network error. Please try again.', 'error');
          } finally {
            button.disabled = false;
            buttonText.textContent = 'Get Coordinates';
          }
        }

        function handleAddressValidation(data, addressField) {
          const { 
            original_address, 
            validated_address, 
            formatted_address, 
            address_quality, 
            address_suggestion,
            location_type,
            validation_error
          } = data;
          
          let message = 'Coordinates updated successfully!';
          let messageType = 'success';
          
          if (validation_error && validation_error.includes('referrer restriction')) {
            message = 'Coordinates found (address validation unavailable due to API settings)';
            messageType = 'warning';
            
            if (formatted_address && formatted_address !== original_address) {
              if (confirm('Google suggests this formatted address:\\n\\n' + formatted_address + '\\n\\nWould you like to use this format?')) {
                addressField.value = formatted_address;
                message = 'Address formatted and coordinates set!';
                messageType = 'success';
              }
            }
            
            showGeocodeMessage(message, messageType);
            return;
          }
          
          switch (address_quality) {
            case 'complete':
              if (formatted_address !== original_address) {
                if (confirm('Google suggests this formatted address:\\n\\n' + formatted_address + '\\n\\nWould you like to use this format?')) {
                  addressField.value = formatted_address;
                  message = 'Address updated and coordinates set!';
                }
              }
              break;
              
            case 'corrected':
              if (address_suggestion && address_suggestion !== original_address) {
                if (confirm('Google corrected your address:\\n\\nOriginal: ' + original_address + '\\nCorrected: ' + address_suggestion + '\\n\\nWould you like to use the corrected address?')) {
                  addressField.value = address_suggestion;
                  message = 'Address corrected and coordinates set!';
                } else {
                  message = 'Coordinates set (using original address)';
                  messageType = 'warning';
                }
              }
              break;
              
            case 'inferred':
              message = 'Coordinates set (some address parts were inferred)';
              messageType = 'warning';
              break;
              
            case 'incomplete':
              message = 'Coordinates found, but address may be incomplete';
              messageType = 'warning';
              break;
              
            default:
              if (formatted_address && formatted_address !== original_address) {
                if (confirm('Google suggests this formatted address:\\n\\n' + formatted_address + '\\n\\nWould you like to use this format?')) {
                  addressField.value = formatted_address;
                  message = 'Address formatted and coordinates set!';
                }
              }
          }
          
          if (location_type === 'ROOFTOP') {
            message += ' (Rooftop precision)';
          } else if (location_type === 'RANGE_INTERPOLATED') {
            message += ' (Street-level precision)';
          }
          
          showGeocodeMessage(message, messageType);
        }

        function showGeocodeMessage(message, type) {
          const messageDiv = document.getElementById('geocode-message');
          messageDiv.textContent = message;
          
          if (type === 'success') {
            messageDiv.className = 'text-sm text-green-600 font-medium animate-fade-in';
          } else if (type === 'warning') {
            messageDiv.className = 'text-sm text-yellow-600 font-medium animate-fade-in';
          } else {
            messageDiv.className = 'text-sm text-red-600 font-medium animate-fade-in';
          }
          
          if (type === 'success' || type === 'warning') {
            setTimeout(() => {
              messageDiv.classList.add('animate-fade-out');
              setTimeout(() => {
                messageDiv.className = 'hidden';
              }, 300);
            }, 5000);
          }
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
          // Phone number formatting
          const phoneInput = document.getElementById('phone');
          if (phoneInput) {
            phoneInput.addEventListener('blur', function() {
              const phone = this.value;
              if (phone) {
                const digits = phone.replace(/\\D/g, '');
                if (digits.length === 10) {
                  this.value = '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
                }
              }
            });
          }

          // Expose getCoordinates globally for the geocode button
          window.getCoordinates = getCoordinates;
        });
        `,
      }}
    />
  );
};
