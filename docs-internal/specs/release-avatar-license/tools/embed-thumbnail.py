# Usage: embed.py <in.vrm> <out.vrm> [thumb.png] [--keep-author]: sets the pixiv author unless --keep-author, and, when given, the embedded thumbnail.
import json,struct,sys
def load(p):
    f=open(p,'rb');f.read(12);l,_=struct.unpack('<II',f.read(8));j=json.loads(f.read(l));bl,_=struct.unpack('<II',f.read(8));return j,f.read(bl)
keep='--keep-author' in sys.argv
argv=[a for a in sys.argv if a!='--keep-author']
j,b=load(argv[1]);m=j['extensions']['VRMC_vrm']['meta']
if not keep:m['authors']=['pixiv VRoid Project']
new={}
if len(argv)>3:
    new[j['images'][m['thumbnailImage']]['bufferView']]=open(argv[3],'rb').read()
out=bytearray()
for i,v in enumerate(j['bufferViews']):
    o=v.get('byteOffset',0);d=new.get(i,b[o:o+v['byteLength']])
    while len(out)%4:out.append(0)
    v['byteOffset']=len(out);v['byteLength']=len(d);out+=d
while len(out)%4:out.append(0)
j['buffers'][0]['byteLength']=len(out)
js=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode('utf8');js+=b' '*((4-len(js)%4)%4)
with open(argv[2],'wb') as f:
    f.write(b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(out)));f.write(struct.pack('<I',len(js))+b'JSON');f.write(js);f.write(struct.pack('<I',len(out))+b'BIN\x00');f.write(out)
