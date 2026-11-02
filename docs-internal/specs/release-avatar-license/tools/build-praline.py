# Builds Praline from VRoid sample F: picker-ready hair and iris with factors that restore the source look, a separate stocking layer, new body keys, name, author and thumbnail.
# Usage: python build-praline.py <AvatarSample_F.vrm> <output.vrm> [--no-thumbnail]
# Thumbnail: build with --no-thumbnail, capture-thumbnail.mjs writes praline-thumbnail.png beside this script, then build again. Reruns embed that file, so they stay byte-identical.
import copy,json,math,os,struct,sys,zlib
SRC,OUT=sys.argv[1],sys.argv[2]
THUMB=None if '--no-thumbnail' in sys.argv else os.path.join(os.path.dirname(os.path.abspath(__file__)),'praline-thumbnail.png')
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
# Same per-channel median the app's picker reads.
def median(px,w,h,ch):
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
            if seen>=math.ceil(n/2): out.append(v);break
    return out
def set_factor(mat,f):
    pb=mat['pbrMetallicRoughness'];pb['baseColorFactor']=[*f,pb.get('baseColorFactor',[1,1,1,1])[3]]
    mt=mat['extensions']['VRMC_materials_mtoon'];mt['shadeColorFactor']=[mt['shadeColorFactor'][c]*f[c] for c in range(3)]
# Divides the source by a factor that moves its median to `mid`, so the texture takes tints and the factor restores the source. Only pixels above the factor clip.
def retex(m,mid,floor=0):
    bvi=tex_view(m);px,w,h,ch=png(view(bvi));med=median(px,w,h,ch)
    f=[min(1,lin(med[c])/lin(mid[c])) for c in range(3)]
    lut=[[max(floor,to8(min(1,lin(v)/f[c]))) for v in range(256)] for c in range(3)]
    for i in range(w*h):
        o=i*ch
        for c in range(3): px[o+c]=lut[c][px[o+c]]
    newviews[bvi]=enc(px,w,h,ch);set_factor(m,f);print(m['name'],'median',med,'factor',[round(x,3) for x in f])
# HAIR_02 sits lower to keep room for its yellow shine.
HAIR_MID=(128,128,128);SHINE_MID=(102,102,102)
# The iris is low in red, so red sits lowest to keep the yellow crescent. The floor keeps every channel tintable.
IRIS_MID=(64,96,96);IRIS_FLOOR=16
for m in j['materials']:
    if 'HAIR_02' in m['name']: retex(m,SHINE_MID)
    elif 'HAIR' in m['name']: retex(m,HAIR_MID)
    if 'EyeIris' in m['name']: retex(m,IRIS_MID,IRIS_FLOOR)
# Stockings
body=[m for m in j['materials'] if 'Body_00_SKIN' in m['name']][0];bi=j['materials'].index(body)
bvi=tex_view(body);px,w,h,ch=png(view(bvi));assert (w,h,ch)==(2048,2048,4)
SKIN=(252,226,204);LEG_L,LEG_R=490,1561
mask=bytearray(w*h);st=bytearray(px)
for y in range(1150,h):
    for x in range(w):
        o=(y*w+x)*4
        if px[o+3]<10: continue
        r,g,bb=px[o],px[o+1],px[o+2]
        if x<LEG_L or x>=LEG_R:
            if y>=1400: on=True
            elif y>=1290: on=abs(r-SKIN[0])+abs(g-SKIN[1])+abs(bb-SKIN[2])>70 or (r-bb<28 and min(r,g,bb)>170)
            else: on=False
        else:
            on=r-bb<28 and min(r,g,bb)>170
        if on: mask[y*w+x]=1
for i in range(w*h):
    o=i*4
    if mask[i]:
        px[o],px[o+1],px[o+2]=SKIN
    else:
        st[o+3]=0
print('stocking pixels',sum(mask))
newviews[bvi]=enc(px,w,h,ch)
j['bufferViews'].append({'buffer':0,'byteLength':0});stv=len(j['bufferViews'])-1;newviews[stv]=enc(st,w,h,ch)
j['images'].append({'name':'Stockings','mimeType':'image/png','bufferView':stv});sti=len(j['images'])-1
j['textures'].append({'source':sti,'sampler':j['textures'][body['pbrMetallicRoughness']['baseColorTexture']['index']].get('sampler',0)});stt=len(j['textures'])-1
sm=copy.deepcopy(body);sm['name']='Stockings_CLOTH';sm['pbrMetallicRoughness']['baseColorTexture']['index']=stt;sm['alphaMode']='MASK';sm.setdefault('alphaCutoff',.5)
mt=sm['extensions']['VRMC_materials_mtoon'];mt['shadeMultiplyTexture']=dict(mt.get('shadeMultiplyTexture',{}),index=stt);mt['shadeColorFactor']=[.82,.78,.8]
j['materials'].append(sm);smi=len(j['materials'])-1
M=[x for x in j['meshes'] if 'Body' in x['name']][0];p0=[p for p in M['primitives'] if p['material']==bi][0];A=p0['attributes']
def acc(i,fmt,c):
    a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']];o=bv.get('byteOffset',0)+a.get('byteOffset',0);sz=struct.calcsize('<'+fmt);s=bv.get('byteStride',sz*c)
    return [struct.unpack_from('<'+fmt*c,b,o+k*s) for k in range(a['count'])]
def indices(p):
    ia=j['accessors'][p['indices']];cc={5125:'I',5123:'H'}[ia['componentType']];bv=j['bufferViews'][ia['bufferView']];o=bv.get('byteOffset',0)+ia.get('byteOffset',0)
    return struct.unpack_from(f'<{ia["count"]}{cc}',b,o)
pos=acc(A['POSITION'],'f',3);nor=acc(A['NORMAL'],'f',3);uv=acc(A['TEXCOORD_0'],'f',2)
idx=indices(p0)
GRID=128;cell=bytearray(GRID*GRID)
for y in range(1150,h):
    for x in range(w):
        if mask[y*w+x]: cell[(y*GRID//h)*GRID+(x*GRID//w)]=1
tris=[]
for t in range(0,len(idx),3):
    us=[uv[idx[t+k]] for k in range(3)];x0=int(min(u[0] for u in us)*GRID);x1=int(max(u[0] for u in us)*GRID);y0=int(min(u[1] for u in us)*GRID);y1=int(max(u[1] for u in us)*GRID)
    if any(cell[min(GRID-1,max(0,yy))*GRID+min(GRID-1,max(0,xx))] for yy in range(y0,y1+1) for xx in range(x0,x1+1)): tris+=idx[t:t+3]
print('stocking tris',len(tris)//3,'of',len(idx)//3)
# A small outward offset keeps the layer above the skin regardless of draw order.
OFF=.0006;np=[tuple(pos[i][k]+nor[i][k]*OFF for k in range(3)) for i in range(len(pos))]
dpos=b''.join(struct.pack('<3f',*v) for v in np)
j['bufferViews'].append({'buffer':0,'byteLength':0});pv=len(j['bufferViews'])-1;newviews[pv]=dpos
j['accessors'].append({'bufferView':pv,'byteOffset':0,'type':'VEC3','componentType':5126,'count':len(np),'max':[max(v[k] for v in np) for k in range(3)],'min':[min(v[k] for v in np) for k in range(3)]});pa=len(j['accessors'])-1
di=struct.pack(f'<{len(tris)}I',*tris)
j['bufferViews'].append({'buffer':0,'byteLength':0});iv=len(j['bufferViews'])-1;newviews[iv]=di
j['accessors'].append({'bufferView':iv,'byteOffset':0,'type':'SCALAR','componentType':5125,'count':len(tris)});ii=len(j['accessors'])-1
np0=copy.deepcopy(p0);np0['indices']=ii;np0['material']=smi;np0['attributes']=dict(A,POSITION=pa);M['primitives'].append(np0)
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
pr=M['primitives']
def verts_of(word):
    out=set()
    for p in pr:
        if word in j['materials'][p['material']]['name'] and p is not np0: out.update(indices(p))
    return out
hairv=verts_of('HAIR');tailv=verts_of('FoxTail')
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
def belly(i):
    v=pos[i];ybc=sy-.02;a=math.exp(-((v[1]-ybc)/.115)**2-(v[0]/.13)**2)*ss(.1,.6,tw[i])*ss(zc-.05,zc+.01,v[2]*front)
    return [v[0]*.62*a,(v[1]-ybc)*.42*a,front*.12*a]
# The tail moves as one piece with the vertex at its root, so it follows the hips without stretching.
TAIL_ROOT=P('J_Opt_C_FoxTail1_01')
tail_root=min(sorted(tailv),key=lambda i:sum((pos[i][k]-TAIL_ROOT[k])**2 for k in range(3)))
tail_tris=indices([p for p in pr if 'FoxTail' in j['materials'][p['material']]['name']][0])
tail_edges=sorted({tuple(sorted((tail_tris[t+a],tail_tris[t+(a+1)%3]))) for t in range(0,len(tail_tris),3) for a in range(3)})
def edge_stretch(ds):
    def L(v,w_,dv=(0,0,0),dw=(0,0,0)): return math.sqrt(sum((v[k]+dv[k]-w_[k]-dw[k])**2 for k in range(3)))
    return max(L(pos[a],pos[c],ds[a],ds[c])/max(1e-6,L(pos[a],pos[c])) for a,c in tail_edges)
KEYS=[('Waist',belly),('Bust',bust),('Thickness',thick)]
targets=[]
for name,fn in KEYS:
    ds=[[0,0,0] if i in hairv else fn(i) for i in range(len(pos))]
    raw=edge_stretch(ds);rd=ds[tail_root]
    for i in tailv: ds[i]=rd
    mx=[max(d[k] for d in ds) for k in range(3)];mn=[min(d[k] for d in ds) for k in range(3)];peak=max(math.sqrt(sum(x*x for x in d)) for d in ds)
    print(name,'peak m',round(peak,4),'moved',sum(1 for d in ds if any(abs(x)>1e-5 for x in d)),'of',len(ds),'tail edge stretch',round(raw,3),'->',round(edge_stretch(ds),3))
    data=b''.join(struct.pack('<3f',*d) for d in ds)
    j['bufferViews'].append({'buffer':0,'byteLength':len(data)});bv=len(j['bufferViews'])-1;newviews[bv]=data
    j['accessors'].append({'bufferView':bv,'byteOffset':0,'type':'VEC3','componentType':5126,'count':len(ds),'max':mx,'min':mn,'normalized':False});targets.append({'POSITION':len(j['accessors'])-1})
names=[k[0] for k in KEYS];M['extras']={'targetNames':names};M['weights']=[0,0,0]
for p in pr:
    p['targets']=[dict(t) for t in targets];p.setdefault('extras',{})['targetNames']=names
meta=j['extensions']['VRMC_vrm']['meta'];meta['name']='Praline';meta['authors']=['pixiv VRoid Project']
if THUMB:
    with open(THUMB,'rb') as f: newviews[j['images'][meta['thumbnailImage']]['bufferView']]=f.read()
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
