export function normalizeDomains(raw:unknown):string[]{
 if(!Array.isArray(raw)||raw.length>100)throw new Error('Enter up to 100 domains.');
 return [...new Set(raw.map(v=>{
  if(typeof v!=='string')throw new Error('Enter domains as text.');
  const d=v.trim().toLowerCase().replace(/^@/,'').replace(/\.$/,'');
  if(d.length>253||!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d))throw new Error('Use a domain such as company.com, without https:// or an email address.');
  return d;
 }))];
}
export function isExcluded(email:string,domains:string[]){const d=email.toLowerCase().split('@').pop()??'';return domains.some(x=>d===x||d.endsWith('.'+x));}
