'use client';
export function SourceDetails({source}:{source:any}) {
 if(!source)return <p>Source information was not collected for this older request.</p>;
 const a=source.assessment,location=[source.city,source.region,source.country].filter(Boolean).join(', ');
 return <div className="source-details">
  <div className="source-heading"><strong>{a?.label||source.proxy||'Request source'}</strong>{a&&<span>{a.confidence} source evidence</span>}</div>
  <dl>
   <div><dt>{a?.locationScope||'Approximate request location'}</dt><dd>{location||'Unavailable'}{a&&<small>{a.locationConfidence}{source.accuracyKm!=null?` · accuracy radius about ${source.accuracyKm.toLocaleString()} km`:''}</small>}</dd></div>
   <div><dt>Network owner</dt><dd>{source.network||'Unavailable'}{source.asn?` · AS${source.asn}`:''}</dd></div>
   <div><dt>Request IP</dt><dd>{source.ip||'Not recorded'}</dd></div>
   <div><dt>Time zone</dt><dd>{source.timezone||'Unavailable'}</dd></div>
   <div><dt>Device / app</dt><dd>{[a?.device,a?.clientApp].filter(Boolean).join(' · ')||'Not identifiable'}</dd></div>
  </dl>
  {a&&<p>{a.evidence}</p>}
  {source.destination&&<p><strong>Link destination:</strong> <a href={source.destination} target="_blank" rel="noreferrer">{source.destination}</a></p>}
  {source.geoStatus==='pending'&&<p>Location lookup is in progress. Refresh the activity to check again.</p>}
  {source.geoStatus==='unavailable'&&source.ip&&<p>Detailed location lookup was unavailable. The captured IP and country are retained.</p>}
  <details><summary>Request evidence</summary><p>{source.client||'Client signature not supplied'}</p><p>Purpose: {source.purpose||'Not supplied'} · Fetch mode: {source.fetchMode||'Not supplied'}</p><p>Location provider: {source.geoProvider||'Not available'}. Network location may describe a relay, VPN or security service. It does not establish a person’s identity or employer.</p></details>
 </div>;
}
