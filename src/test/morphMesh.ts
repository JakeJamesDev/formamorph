import * as THREE from 'three';

/** A real mesh whose geometry carries one morph attribute per name, so three builds the dictionary itself. */
export function morphMesh(names: string[]): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const count = geometry.attributes.position.count;
  geometry.morphAttributes.position = names.map((name) => {
    const attribute = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3);
    attribute.name = name;
    return attribute;
  });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.updateMorphTargets();
  return mesh;
}
