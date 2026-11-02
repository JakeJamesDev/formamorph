# Checks .vrm files against the spec's Permissive License gate list. Exits 1 when a file fails.
# Usage: python check-avatar-license.py <file.vrm> [<file.vrm> ...]
import json,struct,sys
REQUIRED={
    'avatarPermission':'everyone',
    'allowRedistribution':True,
    'modification':'allowModificationRedistribution',
    'commercialUsage':'corporation',
    'allowExcessivelySexualUsage':True,
    'allowExcessivelyViolentUsage':True,
    'allowPoliticalOrReligiousUsage':True,
    'allowAntisocialOrHateUsage':True,
    'creditNotation':'unnecessary',
    'licenseUrl':'https://vrm.dev/licenses/1.0/',
}
def meta(path):
    with open(path,'rb') as f:
        f.read(12);length,_=struct.unpack('<II',f.read(8));return json.loads(f.read(length)).get('extensions',{}).get('VRMC_vrm',{}).get('meta')
ok=True
for path in sys.argv[1:]:
    m=meta(path)
    failed=['metaVersion'] if m is None else [k for k,v in REQUIRED.items() if m.get(k)!=v]
    if m and m.get('otherLicenseUrl'): failed.append('otherLicenseUrl')
    ok=ok and not failed
    print(path,'PASS' if not failed else 'FAIL '+' '.join(failed))
    if m: print(ascii({'name':m.get('name'),'authors':m.get('authors')}))
sys.exit(0 if ok else 1)
