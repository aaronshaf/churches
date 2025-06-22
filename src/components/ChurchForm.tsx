import { FC } from 'hono/jsx';
import { formGroupClass, labelClass, inputClass, buttonClass, errorClass } from '../styles/forms';

type ChurchFormProps = {
  action: string;
  church?: any;
  affiliations?: any[];
  churchAffiliations?: any[];
  counties?: any[];
  error?: string;
  isNew?: boolean;
};

export const ChurchForm: FC<ChurchFormProps> = ({ 
  action, 
  church, 
  affiliations = [], 
  churchAffiliations = [],
  counties = [],
  error, 
  isNew = false 
}) => {
  const statusOptions = ['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed'];
  
  return (
    <form method="POST" action={action}>
      <h2 style="margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 600;">
        {isNew ? 'Create New Church' : 'Edit Church'}
      </h2>
      
      {error && (
        <p class={errorClass} style="margin-bottom: 1rem;">
          {error}
        </p>
      )}
      
      <div class={formGroupClass}>
        <label for="name" class={labelClass}>Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          required
          class={inputClass}
          value={church?.name || ''}
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="path" class={labelClass}>Path (URL slug)</label>
        <input
          type="text"
          id="path"
          name="path"
          class={inputClass}
          value={church?.path || ''}
          placeholder="e.g., first-baptist-church-salt-lake"
          pattern="[a-z0-9\-]+"
          title="Only lowercase letters, numbers, and hyphens allowed"
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="status" class={labelClass}>Status</label>
        <select
          id="status"
          name="status"
          class={inputClass}
        >
          <option value="">Select status</option>
          {statusOptions.map(status => (
            <option value={status} selected={church?.status === status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      
      <div class={formGroupClass}>
        <label for="gatheringAddress" class={labelClass}>Gathering Address</label>
        <input
          type="text"
          id="gatheringAddress"
          name="gatheringAddress"
          class={inputClass}
          value={church?.gatheringAddress || ''}
        />
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class={formGroupClass}>
          <label for="latitude" class={labelClass}>Latitude</label>
          <input
            type="number"
            id="latitude"
            name="latitude"
            step="any"
            class={inputClass}
            value={church?.latitude || ''}
          />
        </div>
        
        <div class={formGroupClass}>
          <label for="longitude" class={labelClass}>Longitude</label>
          <input
            type="number"
            id="longitude"
            name="longitude"
            step="any"
            class={inputClass}
            value={church?.longitude || ''}
          />
        </div>
      </div>
      
      <div class={formGroupClass}>
        <label for="countyId" class={labelClass}>County</label>
        <select
          id="countyId"
          name="countyId"
          class={inputClass}
        >
          <option value="">Select county</option>
          {counties.map(county => (
            <option value={county.id} selected={church?.countyId === county.id}>
              {county.name}
            </option>
          ))}
        </select>
      </div>
      
      <div class={formGroupClass}>
        <label for="serviceTimes" class={labelClass}>Service Times</label>
        <input
          type="text"
          id="serviceTimes"
          name="serviceTimes"
          class={inputClass}
          value={church?.serviceTimes || ''}
          placeholder="e.g., Sunday 10:30am, Wednesday 7:00pm"
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="website" class={labelClass}>Website</label>
        <input
          type="url"
          id="website"
          name="website"
          class={inputClass}
          value={church?.website || ''}
          placeholder="https://example.com"
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="statementOfFaith" class={labelClass}>Statement of Faith URL</label>
        <input
          type="url"
          id="statementOfFaith"
          name="statementOfFaith"
          class={inputClass}
          value={church?.statementOfFaith || ''}
        />
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class={formGroupClass}>
          <label for="phone" class={labelClass}>Phone</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            class={inputClass}
            value={church?.phone || ''}
          />
        </div>
        
        <div class={formGroupClass}>
          <label for="email" class={labelClass}>Email</label>
          <input
            type="email"
            id="email"
            name="email"
            class={inputClass}
            value={church?.email || ''}
          />
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class={formGroupClass}>
          <label for="facebook" class={labelClass}>Facebook</label>
          <input
            type="url"
            id="facebook"
            name="facebook"
            class={inputClass}
            value={church?.facebook || ''}
            placeholder="https://facebook.com/..."
          />
        </div>
        
        <div class={formGroupClass}>
          <label for="instagram" class={labelClass}>Instagram</label>
          <input
            type="url"
            id="instagram"
            name="instagram"
            class={inputClass}
            value={church?.instagram || ''}
            placeholder="https://instagram.com/..."
          />
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class={formGroupClass}>
          <label for="youtube" class={labelClass}>YouTube</label>
          <input
            type="url"
            id="youtube"
            name="youtube"
            class={inputClass}
            value={church?.youtube || ''}
            placeholder="https://youtube.com/..."
          />
        </div>
        
        <div class={formGroupClass}>
          <label for="spotify" class={labelClass}>Spotify</label>
          <input
            type="url"
            id="spotify"
            name="spotify"
            class={inputClass}
            value={church?.spotify || ''}
            placeholder="https://open.spotify.com/..."
          />
        </div>
      </div>
      
      <div class={formGroupClass}>
        <label for="publicNotes" class={labelClass}>Public Notes</label>
        <textarea
          id="publicNotes"
          name="publicNotes"
          class={inputClass}
          rows="3"
          placeholder="Notes visible to the public"
        >{church?.publicNotes || ''}</textarea>
      </div>
      
      <div class={formGroupClass}>
        <label for="privateNotes" class={labelClass}>Private Notes</label>
        <textarea
          id="privateNotes"
          name="privateNotes"
          class={inputClass}
          rows="3"
          placeholder="Internal notes for administrators only"
        >{church?.privateNotes || ''}</textarea>
      </div>
      
      <div class={formGroupClass}>
        <label class={labelClass}>Affiliations</label>
        <div style="max-height: 200px; overflow-y: auto; border: 1px solid #d1d5db; border-radius: 4px; padding: 0.5rem;">
          {affiliations.map((affiliation, index) => {
            const isChecked = churchAffiliations.some(ca => ca.affiliationId === affiliation.id);
            return (
              <label style="display: block; padding: 0.25rem;">
                <input
                  type="checkbox"
                  name="affiliations"
                  value={affiliation.id}
                  checked={isChecked}
                  style="margin-right: 0.5rem;"
                />
                {affiliation.name}
              </label>
            );
          })}
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; margin-top: 2rem;">
        <button type="submit" class={buttonClass}>
          {isNew ? 'Create Church' : 'Update Church'}
        </button>
        <a href="/admin/churches" class={buttonClass} style="background-color: #6b7280; text-align: center; text-decoration: none;">
          Cancel
        </a>
      </div>
    </form>
  );
};