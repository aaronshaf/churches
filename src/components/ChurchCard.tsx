import { FC } from 'hono/jsx';
import { 
  churchCardClass, 
  churchNameClass, 
  churchInfoClass, 
  statusBadgeClass, 
  statusClasses 
} from '../styles/components';

type Church = {
  id: number;
  name: string;
  status: string | null;
  gatheringAddress: string | null;
  countyName?: string | null;
  serviceTimes: string | null;
  website: string | null;
  publicNotes?: string | null;
};

type ChurchCardProps = {
  church: Church;
};

export const ChurchCard: FC<ChurchCardProps> = ({ church }) => {
  const statusClass = church.status && statusClasses[church.status as keyof typeof statusClasses];
  
  return (
    <div class={churchCardClass}>
      <h3 class={churchNameClass}>{church.name}</h3>
      
      <div>
        {church.gatheringAddress && (
          <p class={churchInfoClass}>
            <span>📍</span>
            <span>{church.gatheringAddress}</span>
          </p>
        )}
        
        {church.countyName && (
          <p class={churchInfoClass}>
            <span>📌</span>
            <span>{church.countyName} County</span>
          </p>
        )}
        
        {church.serviceTimes && (
          <p class={churchInfoClass}>
            <span>🕐</span>
            <span>{church.serviceTimes}</span>
          </p>
        )}
        
        {church.website && (
          <p class={churchInfoClass}>
            <span>🌐</span>
            <a 
              href={church.website} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Website
            </a>
          </p>
        )}
        
        {church.publicNotes && (
          <p class={churchInfoClass} style="font-style: italic;">
            {church.publicNotes}
          </p>
        )}
      </div>
      
      {church.status && (
        <span class={`${statusBadgeClass} ${statusClass}`}>
          {church.status}
        </span>
      )}
    </div>
  );
};