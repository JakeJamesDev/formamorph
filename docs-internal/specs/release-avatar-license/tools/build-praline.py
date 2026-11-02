# Recolors hair and iris for the picker and moves the painted stockings out of the Body skin into their own material.
# Usage: python build-praline.py <AvatarSample_F.vrm> <output.vrm>
import copy,json,struct,sys,zlib,os
SRC,OUT=sys.argv[1],sys.argv[2]
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
def avg_lum(px,w,h,ch):
    t=n=0
    for i in range(0,w*h,3):
        o=i*ch
        if ch==4 and px[o+3]<10: continue
        t+=(px[o]*.3+px[o+1]*.59+px[o+2]*.11);n+=1
    return t/max(n,1)
# Hair keeps its strand shading, shifted to a warm mid-tone with all channels well above zero.
HAIR=(150,118,98)
done=set()
for m in j['materials']:
    if 'HAIR' in m['name']:
        bvi=tex_view(m)
        if bvi in done: continue
        done.add(bvi);px,w,h,ch=png(view(bvi));L=avg_lum(px,w,h,ch);G=1/max(L,1)
        for i in range(w*h):
            o=i*ch;l=(px[o]*.3+px[o+1]*.59+px[o+2]*.11)*G
            for c in range(3): px[o+c]=min(255,round(HAIR[c]*l))
        newviews[bvi]=enc(px,w,h,ch)
    if 'EyeIris' in m['name']:
        bvi=tex_view(m);px,w,h,ch=png(view(bvi))
        for i in range(w*h):
            o=i*ch;r,g,bb=px[o],px[o+1],px[o+2];l=r*.3+g*.59+bb*.11
            px[o],px[o+1],px[o+2]=min(255,round((r+l)*.62+22)),min(255,round((g+l)*.62+14)),min(255,round((bb+l)*.62+18))
        newviews[bvi]=enc(px,w,h,ch)
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
sm=copy.deepcopy(body);sm['name']='N00_000_00_Stockings_00_CLOTH';sm['pbrMetallicRoughness']['baseColorTexture']['index']=stt;sm['alphaMode']='MASK';sm.setdefault('alphaCutoff',.5)
mt=sm['extensions']['VRMC_materials_mtoon'];mt['shadeMultiplyTexture']=dict(mt.get('shadeMultiplyTexture',{}),index=stt);mt['shadeColorFactor']=[.82,.78,.8]
j['materials'].append(sm);smi=len(j['materials'])-1
M=[x for x in j['meshes'] if 'Body' in x['name']][0];p0=[p for p in M['primitives'] if p['material']==bi][0];A=p0['attributes']
def acc(i,fmt,c):
    a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']];o=bv.get('byteOffset',0)+a.get('byteOffset',0);sz=struct.calcsize('<'+fmt);s=bv.get('byteStride',sz*c)
    return [struct.unpack_from('<'+fmt*c,b,o+k*s) for k in range(a['count'])]
pos=acc(A['POSITION'],'f',3);nor=acc(A['NORMAL'],'f',3);uv=acc(A['TEXCOORD_0'],'f',2)
ia=j['accessors'][p0['indices']];cc={5125:'I',5123:'H'}[ia['componentType']];bv=j['bufferViews'][ia['bufferView']];o=bv.get('byteOffset',0)+ia.get('byteOffset',0);idx=struct.unpack_from(f'<{ia["count"]}{cc}',b,o)
G=128;cell=bytearray(G*G)
for y in range(1150,h):
    for x in range(w):
        if mask[y*w+x]: cell[(y*G//h)*G+(x*G//w)]=1
tris=[]
for t in range(0,len(idx),3):
    us=[uv[idx[t+k]] for k in range(3)];x0=int(min(u[0] for u in us)*G);x1=int(max(u[0] for u in us)*G);y0=int(min(u[1] for u in us)*G);y1=int(max(u[1] for u in us)*G)
    if any(cell[min(G-1,max(0,yy))*G+min(G-1,max(0,xx))] for yy in range(y0,y1+1) for xx in range(x0,x1+1)): tris+=idx[t:t+3]
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
meta=j['extensions']['VRMC_vrm']['meta'];meta['allowRedistribution']=True;meta['modification']='allowModificationRedistribution'
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
