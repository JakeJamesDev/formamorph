# Builds a community upload from VRoid sample B, J or U: picker-ready hair and iris with factors that restore the source look, new body keys, and B's accents on their own mesh.
# Usage: python build-sample-avatar.py <AvatarSample_X.vrm> <output.vrm> [--name <name>]
import json,math,os,struct,sys,zlib
SRC,OUT=sys.argv[1],sys.argv[2]
NAME=sys.argv[sys.argv.index('--name')+1] if '--name' in sys.argv else None
def load(p):
    f=open(p,'rb');f.read(12);l,_=struct.unpack('<II',f.read(8));j=json.loads(f.read(l));bl,_=struct.unpack('<II',f.read(8));return j,f.read(bl)
def png(d):
    i=8;idat=[]
    while i<len(d):
        n,t=struct.unpack('>I4s',d[i:i+8]);c=d[i+8:i+8+n];i+=12+n
        if t==b'IHDR': w,h,bd,ct,_,_,il=struct.unpack('>IIBBBBB',c)
        elif t==b'IDAT': idat.append(c)
    assert bd==8 and not il and ct in(2,6)
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
                a=line[x-ch] if x>=ch else 0;b_=prev[x];c0=prev[x-ch] if x>=ch else 0;q=a+b_-c0;pa,pb,pc=abs(q-a),abs(q-b_),abs(q-c0)
                line[x]=(line[x]+(a if pa<=pb and pa<=pc else b_ if pb<=pc else c0))&255
        out[y*st:(y+1)*st]=line;prev=line
    return out,w,h,ch
def enc(px,w,h,ch):
    st=w*ch;raw=bytearray();prev=bytes(st)
    for y in range(h):
        line=bytes(px[y*st:(y+1)*st])
        up=bytes((a-b_)&255 for a,b_ in zip(line,prev))
        raw.append(2);raw+=up;prev=line
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6 if ch==4 else 2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
j,b=load(SRC)
def view(i):
    v=j['bufferViews'][i];o=v.get('byteOffset',0);return b[o:o+v['byteLength']]
newviews={}
def tex_view(mat):
    return j['images'][j['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]['bufferView']
def lin(v):
    c=v/255;return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def to8(l):
    c=l*12.92 if l<=.0031308 else 1.055*l**(1/2.4)-.055;return min(255,round(c*255))
# Per-channel value at a fraction of the opaque pixels. At .5 it is the median the app's picker reads.
def quantile(px,w,h,ch,q):
    hist=[[0]*256 for _ in range(3)];n=0
    for i in range(w*h):
        o=i*ch
        if ch==4 and px[o+3]<10: continue
        for c in range(3): hist[c][px[o+c]]+=1
        n+=1
    out=[]
    for c in range(3):
        seen=0
        for v in range(256):
            seen+=hist[c][v]
            if seen>=math.ceil(n*q): out.append(v);break
    return out
def set_factor(mat,f):
    pb=mat['pbrMetallicRoughness'];pb['baseColorFactor']=[*f,pb.get('baseColorFactor',[1,1,1,1])[3]]
    mt=mat['extensions']['VRMC_materials_mtoon'];mt['shadeColorFactor']=[mt['shadeColorFactor'][c]*f[c] for c in range(3)]
# Divides the source by a factor that moves its median toward `mid`, so the texture takes tints and the factor restores the source. The factor stays above the top 1% of pixels, so shine survives.
def retex(m,mid):
    bvi=tex_view(m);px,w,h,ch=png(view(bvi));med=quantile(px,w,h,ch,.5);top=quantile(px,w,h,ch,.99)
    f=[min(1,max(lin(med[c])/lin(mid),lin(top[c]))) for c in range(3)]
    lut=[[to8(min(1,lin(v)/f[c])) for v in range(256)] for c in range(3)]
    for i in range(w*h):
        o=i*ch
        for c in range(3): px[o+c]=lut[c][px[o+c]]
    newviews[bvi]=enc(px,w,h,ch);set_factor(m,f)
    print(m['name'],'median',med,'->',[lut[c][med[c]] for c in range(3)],'factor',[round(x,3) for x in f])
# B's clips, metal, streaks and ears sit on its hair mesh, so the hair picker would flatten them. Every material on a mesh named for hair joins that picker, so they need their own mesh.
ACCENTS={'HAIR_03':'Clips_CLOTH','HAIR_04':'Metal_CLOTH','HAIR_05':'Streaks_CLOTH','HAIR_06':'Ears_CLOTH'}
if len([m for m in j['materials'] if 'HAIR' in m['name'] and 'HairBack' not in m['name']])==6:
    H=[x for x in j['meshes'] if 'Hair' in x['name']][0]
    for m in j['materials']:
        for k,v in ACCENTS.items():
            if k in m['name']: m['name']=v
    isacc=lambda p:j['materials'][p['material']]['name'] in ACCENTS.values()
    j['meshes'].append({'name':'Accents','primitives':[p for p in H['primitives'] if isacc(p)]})
    H['primitives']=[p for p in H['primitives'] if not isacc(p)]
    hn=[n for n in j['nodes'] if n.get('mesh')==j['meshes'].index(H)][0]
    j['nodes'].append({'name':'Accents','mesh':len(j['meshes'])-1,'skin':hn['skin']})
    j['scenes'][0]['nodes'].append(len(j['nodes'])-1)
HAIR_MID=128;IRIS_MID=96
for m in j['materials']:
    if 'HAIR' in m['name']: retex(m,HAIR_MID)
    if 'EyeIris' in m['name']: retex(m,IRIS_MID)
M=[x for x in j['meshes'] if 'Body' in x['name']][0];pr=M['primitives'];A=pr[0]['attributes']
assert all(p['attributes']['POSITION']==A['POSITION'] for p in pr)
def acc(i,fmt,c):
    a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']];o=bv.get('byteOffset',0)+a.get('byteOffset',0);sz=struct.calcsize('<'+fmt);s=bv.get('byteStride',sz*c)
    return [struct.unpack_from('<'+fmt*c,b,o+k*s) for k in range(a['count'])]
def indices(p):
    ia=j['accessors'][p['indices']];cc={5125:'I',5123:'H'}[ia['componentType']];bv=j['bufferViews'][ia['bufferView']];o=bv.get('byteOffset',0)+ia.get('byteOffset',0)
    return struct.unpack_from(f'<{ia["count"]}{cc}',b,o)
pos=acc(A['POSITION'],'f',3)
# Body keys, by the method in build-release-avatar.py.
N=j['nodes'];par={}
for i,n in enumerate(N):
    for c in n.get('children',[]):par[c]=i
def rotv(q,v):
    x,y,z,w_=q;t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])]
    return [v[0]+w_*t[0]+y*t[2]-z*t[1],v[1]+w_*t[1]+z*t[0]-x*t[2],v[2]+w_*t[2]+x*t[1]-y*t[0]]
def wpos(i):
    p=[0,0,0]
    while i is not None:
        n=N[i];p=rotv(n.get('rotation',[0,0,0,1]),[p[k]*n.get('scale',[1,1,1])[k] for k in range(3)]);t=n.get('translation',[0,0,0]);p=[p[k]+t[k] for k in range(3)];i=par.get(i)
    return p
ID={n['name']:i for i,n in enumerate(N)}
P=lambda name:wpos(ID[name])
front=1 if P('J_Bip_L_ToeBase')[2]>P('J_Bip_L_Foot')[2] else -1
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
def verts_of(*words):
    out=set()
    for p in pr:
        if any(w in j['materials'][p['material']]['name'] for w in words): out.update(indices(p))
    return out
hairv=verts_of('HAIR');tailv=verts_of('FoxTail','CatTail')
def ss(a,bb,x):
    t=max(0,min(1,(x-a)/(bb-a)));return t*t*(3-2*t)
def thick(i):
    v=pos[i];d=[0,0,0]
    for jj,w_ in zip(joints[i],wts[i]):
        s=SEGS[jj] if jj<len(SEGS) else None
        if w_<=0 or not s: continue
        a,c,amt=s;ab=[c[k]-a[k] for k in range(3)];t=max(0,min(1,sum((v[k]-a[k])*ab[k] for k in range(3))/max(1e-9,sum(x*x for x in ab))))
        q=[a[k]+ab[k]*t for k in range(3)];r=[v[k]-q[k] for k in range(3)];l=math.sqrt(sum(x*x for x in r))
        if l<.003: continue
        for k in range(3): d[k]+=w_*amt*r[k]/l
    return d
sy=P('J_Bip_C_Spine')[1];zc=P('J_Bip_C_Spine')[2]*front
bL=P('J_Sec_L_Bust2');bR=P('J_Sec_R_Bust2');bsig=.058
tw=[sum(w_ for jj,w_ in zip(joints[i],wts[i]) if jj<len(TORSO) and TORSO[jj]) for i in range(len(pos))]
def bust(i):
    v=pos[i];d=[0,0,0];g=ss(.2,.8,tw[i])*ss(zc-.02,zc+.03,v[2]*front)
    for c,sx in((bL,1),(bR,-1)):
        r2=sum((v[k]-c[k])**2 for k in range(3));a=math.exp(-r2/(2*bsig*bsig))*g
        d[2]+=front*.055*a;d[0]+=(v[0]-c[0])*.45*a;d[1]+=(v[1]-c[1])*.35*a-.006*a
    return d
ybc=sy-.02
SKIRT_W=[sum(w_ for jj,w_ in zip(joints[i],wts[i]) if jj<len(skin) and 'Skirt' in N[skin[jj]]['name']) for i in range(len(pos))]
SKIRT_DROP=max((ybc-pos[i][1] for i in range(len(pos)) if SKIRT_W[i]>.05),default=1)
# How much of the waist's push reaches the hem.
HEM_SHARE=.5;SKIRT_R=.14
# A skirt drapes over the belly: each point takes the push at its angle around the body, fading toward the hem.
def drape(i):
    v=pos[i];zr=v[2]*front-zc;sc=min(1,SKIRT_R/max(1e-6,math.hypot(v[0],zr)));xa=v[0]*sc;za=zr*sc;up=max(0,v[1]-ybc)
    a=math.exp(-(up/.115)**2-(xa/.13)**2)*ss(-.05,.01,za)*(1-(1-HEM_SHARE)*ss(0,SKIRT_DROP,max(0,ybc-v[1])))
    return [xa*.62*a,up*.42*a,front*.12*a]
def belly(i):
    v=pos[i];a=math.exp(-((v[1]-ybc)/.115)**2-(v[0]/.13)**2)*ss(.1,.6,tw[i])*ss(zc-.05,zc+.01,v[2]*front)
    d=[v[0]*.62*a,(v[1]-ybc)*.42*a,front*.12*a];s=min(1,SKIRT_W[i])
    if s<=0: return d
    q=drape(i);return [d[k]*(1-s)+q[k]*s for k in range(3)]
# A tail moves as one piece with the vertex at its root, so it follows the hips without stretching.
tail_root=None
if tailv:
    root=P([n for n in ID if n in('J_Opt_C_FoxTail1_01','J_Opt_C_CatTail1_01')][0])
    tail_root=min(sorted(tailv),key=lambda i:sum((pos[i][k]-root[k])**2 for k in range(3)))
KEYS=[('Waist',belly),('Bust',bust),('Thickness',thick)]
targets=[]
for name,fn in KEYS:
    ds=[[0,0,0] if i in hairv else fn(i) for i in range(len(pos))]
    if tail_root is not None:
        rd=ds[tail_root]
        for i in tailv: ds[i]=rd
    mx=[max(d[k] for d in ds) for k in range(3)];mn=[min(d[k] for d in ds) for k in range(3)];peak=max(math.sqrt(sum(x*x for x in d)) for d in ds)
    print(name,'peak m',round(peak,4),'moved',sum(1 for d in ds if any(abs(x)>1e-5 for x in d)),'of',len(ds))
    data=b''.join(struct.pack('<3f',*d) for d in ds)
    j['bufferViews'].append({'buffer':0,'byteLength':len(data)});bv=len(j['bufferViews'])-1;newviews[bv]=data
    j['accessors'].append({'bufferView':bv,'byteOffset':0,'type':'VEC3','componentType':5126,'count':len(ds),'max':mx,'min':mn,'normalized':False});targets.append({'POSITION':len(j['accessors'])-1})
names=[k[0] for k in KEYS];M['extras']={'targetNames':names};M['weights']=[0,0,0]
for p in pr:
    p['targets']=[dict(t) for t in targets];p.setdefault('extras',{})['targetNames']=names
if NAME: j['extensions']['VRMC_vrm']['meta']['name']=NAME
out=bytearray()
for i,v in enumerate(j['bufferViews']):
    d=newviews[i] if i in newviews else view(i)
    while len(out)%4:out.append(0)
    v['byteOffset']=len(out);v['byteLength']=len(d);out+=d
while len(out)%4:out.append(0)
j['buffers'][0]['byteLength']=len(out)
js=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode('utf8');js+=b' '*((4-len(js)%4)%4)
with open(OUT,'wb') as f:
    f.write(b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(out)));f.write(struct.pack('<I',len(js))+b'JSON');f.write(js);f.write(struct.pack('<I',len(out))+b'BIN\x00');f.write(out)
print('wrote',round(os.path.getsize(OUT)/1e6,1),'MB')
