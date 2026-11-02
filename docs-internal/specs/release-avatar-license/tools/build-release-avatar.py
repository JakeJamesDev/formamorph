# Builds the release Avatar from its VRoid Hub file: new body keys and recolored hair and iris textures.
# Usage: python build-release-avatar.py <hub file.vrm> <output.vrm> <model name>
import json,struct,zlib,math,sys,os
def load(p):
    f=open(p,'rb');f.read(12);l,_=struct.unpack('<II',f.read(8));j=json.loads(f.read(l));bl,_=struct.unpack('<II',f.read(8));return j,f.read(bl)
def png(d):
    i=8;idat=[];
    while i<len(d):
        n,t=struct.unpack('>I4s',d[i:i+8]);c=d[i+8:i+8+n];i+=12+n
        if t==b'IHDR': w,h,bd,ct,_,_,il=struct.unpack('>IIBBBBB',c)
        elif t==b'IDAT': idat.append(c)
    if bd!=8 or il or ct not in(2,6): return None,(w,h,bd,ct,il)
    ch=4 if ct==6 else 3; raw=zlib.decompress(b''.join(idat)); st=w*ch; out=bytearray(h*st); prev=bytearray(st); p=0
    for y in range(h):
        ft=raw[p];p+=1;line=bytearray(raw[p:p+st]);p+=st
        if ft==1:
            for x in range(ch,st): line[x]=(line[x]+line[x-ch])&255
        elif ft==2:
            for x in range(st): line[x]=(line[x]+prev[x])&255
        elif ft==3:
            for x in range(st): line[x]=(line[x]+(((line[x-ch] if x>=ch else 0)+prev[x])>>1))&255
        elif ft==4:
            for x in range(st):
                a=line[x-ch] if x>=ch else 0;b=prev[x];c0=prev[x-ch] if x>=ch else 0;q=a+b-c0;pa,pb,pc=abs(q-a),abs(q-b),abs(q-c0)
                line[x]=(line[x]+(a if pa<=pb and pa<=pc else b if pb<=pc else c0))&255
        out[y*st:(y+1)*st]=line;prev=line
    return (out,w,h,ch),None
SRC,OUT=sys.argv[1],sys.argv[2]
j,b=load(SRC)
NV=len(j['bufferViews'])
def view(i):
    v=j['bufferViews'][i];o=v.get('byteOffset',0);return b[o:o+v['byteLength']]
def enc(px,w,h,ch):
    st=w*ch;raw=bytearray()
    for y in range(h):
        raw.append(0);raw+=px[y*st:(y+1)*st]
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6 if ch==4 else 2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
newviews={}
# Writes a texture the picker can tint, and color factors that restore the source look until a picker is touched.
def retex(mat,fn,factor):
    s=j['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source'];bvi=j['images'][s]['bufferView']
    t,err=png(view(bvi));assert t,err;px,w,h,ch=t
    for i in range(w*h):
        o=i*ch;px[o],px[o+1],px[o+2]=fn(px[o],px[o+1],px[o+2])
    newviews[bvi]=enc(px,w,h,ch)
    mat['pbrMetallicRoughness']['baseColorFactor']=[*factor,mat['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1])[3]]
    mat['extensions']['VRMC_materials_mtoon']['shadeColorFactor']=list(factor)
HAIR=(140,132,140)
for m in j['materials']:
    if 'HAIR' in m['name']: retex(m,lambda r,g,bb:HAIR,(0,0,0))
    if 'EyeIris' in m['name']: retex(m,lambda r,g,bb:(r,min(255,round(r*.75)),min(255,round(r*.78))),(1,0,0))
N=j['nodes'];par={}
for i,n in enumerate(N):
    for c in n.get('children',[]):par[c]=i
def rotv(q,v):
    x,y,z,w=q;t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])]
    return [v[0]+w*t[0]+y*t[2]-z*t[1],v[1]+w*t[1]+z*t[0]-x*t[2],v[2]+w*t[2]+x*t[1]-y*t[0]]
def wpos(i):
    p=[0,0,0]
    while i is not None:
        n=N[i];p=rotv(n.get('rotation',[0,0,0,1]),[p[k]*n.get('scale',[1,1,1])[k] for k in range(3)]);t=n.get('translation',[0,0,0]);p=[p[k]+t[k] for k in range(3)];i=par.get(i)
    return p
ID={n['name']:i for i,n in enumerate(N)}
P=lambda name:wpos(ID[name])
front=1 if P('J_Bip_L_ToeBase')[2]>P('J_Bip_L_Foot')[2] else -1
print('front',front,'hips',P('J_Bip_C_Hips'),'spine',P('J_Bip_C_Spine'),'chest',P('J_Bip_C_Chest'),'bust',P('J_Sec_L_Bust2'),'head',P('J_Bip_C_Head'))
M=[m for m in j['meshes'] if 'Body' in m['name']][0];pr=M['primitives'];A=pr[0]['attributes']
def acc(i,fmt,comps):
    a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']];o=bv.get('byteOffset',0)+a.get('byteOffset',0);sz=struct.calcsize('<'+fmt);st=bv.get('byteStride',sz*comps)
    return [struct.unpack_from('<'+fmt*comps,b,o+k*st) for k in range(a['count'])]
pos=acc(A['POSITION'],'f',3)
jt=j['accessors'][A['JOINTS_0']]['componentType'];joints=acc(A['JOINTS_0'],'H' if jt==5123 else 'B',4);wts=acc(A['WEIGHTS_0'],'f',4)
skin=j['skins'][[n for n in N if n['name']=='Body'][0]['skin']]['joints']
def bip(i):
    while i is not None:
        nm=N[i]['name']
        if nm.startswith('J_Bip') or 'Bust' in nm: return nm
        i=par.get(i)
    return 'J_Bip_C_Hips'
cls=[bip(i) for i in skin]
SEG={'UpperLeg':('UpperLeg','LowerLeg',.034),'LowerLeg':('LowerLeg','Foot',.016),'UpperArm':('UpperArm','LowerArm',.012),'LowerArm':('LowerArm','Hand',.006)}
TOR={'J_Bip_C_Hips':.036,'J_Bip_C_Spine':.030,'J_Bip_C_Chest':.024,'J_Bip_C_UpperChest':.016}
def seg_for(nm):
    for k,(a,c,amt) in SEG.items():
        if nm.endswith(k):
            s=nm.split('_')[2];return P(f'J_Bip_{s}_{a}'),P(f'J_Bip_{s}_{c}'),amt
    if nm in TOR:
        y=P('J_Bip_C_Hips');nk=P('J_Bip_C_Neck');return [0,y[1]-.3,y[2]],[0,nk[1],nk[2]],TOR[nm]
    if 'Bust' in nm:
        return P('J_Bip_C_Chest'),P('J_Bip_C_UpperChest'),.018
    return None
SEGS=[seg_for(c) for c in cls]
TORSO=[c in TOR or 'Bust' in c for c in cls]
hairv=set()
for p in pr:
    if 'HAIR' in j['materials'][p['material']]['name']:
        ia=j['accessors'][p['indices']];c={5125:'I',5123:'H'}[ia['componentType']];bv=j['bufferViews'][ia['bufferView']];o=bv.get('byteOffset',0)+ia.get('byteOffset',0)
        hairv.update(struct.unpack_from(f'<{ia["count"]}{c}',b,o))
def ss(a,bb,x):
    t=max(0,min(1,(x-a)/(bb-a)));return t*t*(3-2*t)
def thick(i):
    v=pos[i];d=[0,0,0]
    for jj,w in zip(joints[i],wts[i]):
        s=SEGS[jj] if jj<len(SEGS) else None
        if w<=0 or not s: continue
        a,c,amt=s;ab=[c[k]-a[k] for k in range(3)];t=max(0,min(1,sum((v[k]-a[k])*ab[k] for k in range(3))/max(1e-9,sum(x*x for x in ab))))
        q=[a[k]+ab[k]*t for k in range(3)];r=[v[k]-q[k] for k in range(3)];l=math.sqrt(sum(x*x for x in r))
        if l<.003: continue
        for k in range(3): d[k]+=w*amt*r[k]/l
    return d
sy=P('J_Bip_C_Spine')[1];zc=P('J_Bip_C_Spine')[2]*front
bL=P('J_Sec_L_Bust2');bR=P('J_Sec_R_Bust2');bsig=.058
tw=[sum(w for jj,w in zip(joints[i],wts[i]) if jj<len(TORSO) and TORSO[jj]) for i in range(len(pos))]
def bust(i):
    v=pos[i];d=[0,0,0];g=ss(.2,.8,tw[i])*ss(zc-.02,zc+.03,v[2]*front)
    for c,sx in((bL,1),(bR,-1)):
        r2=sum((v[k]-c[k])**2 for k in range(3));a=math.exp(-r2/(2*bsig*bsig))*g
        d[2]+=front*.055*a;d[0]+=(v[0]-c[0])*.45*a;d[1]+=(v[1]-c[1])*.35*a-.006*a
    return d
def belly(i):
    v=pos[i];ybc=sy-.02;a=math.exp(-((v[1]-ybc)/.115)**2-(v[0]/.13)**2)*ss(.1,.6,tw[i])*ss(zc-.05,zc+.01,v[2]*front)
    return [v[0]*.62*a,(v[1]-ybc)*.42*a,front*.12*a]
KEYS=[('Waist',belly),('Bust',bust),('Thickness',thick)]
targets=[]
for name,fn in KEYS:
    ds=[[0,0,0] if i in hairv else fn(i) for i in range(len(pos))]
    mx=[max(d[k] for d in ds) for k in range(3)];mn=[min(d[k] for d in ds) for k in range(3)];peak=max(math.sqrt(sum(x*x for x in d)) for d in ds)
    print(name,'peak m',round(peak,4),'moved',sum(1 for d in ds if any(abs(x)>1e-5 for x in d)),'of',len(ds))
    data=b''.join(struct.pack('<3f',*d) for d in ds)
    j['bufferViews'].append({'buffer':0,'byteLength':len(data)});bv=len(j['bufferViews'])-1;newviews[bv]=data
    j['accessors'].append({'bufferView':bv,'byteOffset':0,'type':'VEC3','componentType':5126,'count':len(ds),'max':mx,'min':mn,'normalized':False});targets.append({'POSITION':len(j['accessors'])-1})
names=[k[0] for k in KEYS];M['extras']={'targetNames':names};M['weights']=[0,0,0]
for p in pr:
    p['targets']=[dict(t) for t in targets];p.setdefault('extras',{})['targetNames']=names
j['extensions']['VRMC_vrm']['meta']['name']=sys.argv[3]
out=bytearray()
for i,v in enumerate(j['bufferViews']):
    d=newviews[i] if i in newviews else view(i)
    while len(out)%4:out.append(0)
    v['byteOffset']=len(out);v['byteLength']=len(d);out+=d
while len(out)%4:out.append(0)
j['buffers'][0]['byteLength']=len(out)
js=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode('utf8')
js+=b' '*((4-len(js)%4)%4)
with open(OUT,'wb') as f:
    f.write(b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(out)));f.write(struct.pack('<I',len(js))+b'JSON');f.write(js);f.write(struct.pack('<I',len(out))+b'BIN\x00');f.write(out)
print('wrote',round(os.path.getsize(OUT)/1e6,1),'MB')
