"""Refresh Apple's published relay ranges. Usage: python scripts/update-relay-ranges.py [downloaded.csv]."""
import datetime, ipaddress, json, pathlib, sys, urllib.request
source='https://mask-api.icloud.com/egress-ip-ranges.csv'
raw=pathlib.Path(sys.argv[1]).read_text() if len(sys.argv)>1 else urllib.request.urlopen(source,timeout=30).read().decode()
networks=[ipaddress.ip_network(line.split(',')[0]) for line in raw.splitlines() if line]
assert len(networks)>1000, 'Unexpectedly small relay feed; keep the existing snapshot'
data={'source':source,'updated':datetime.date.today().isoformat()}
for version in (4,6):
 data['v'+str(version)]=[[str(int(n.network_address)),str(int(n.broadcast_address))] for n in ipaddress.collapse_addresses(n for n in networks if n.version==version)]
pathlib.Path('lib/apple-relay-ranges.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
print('Updated',sum(len(data[k]) for k in ('v4','v6')),'relay ranges')
