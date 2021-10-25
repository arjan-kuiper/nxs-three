import * as THREE from 'three';

export default class NexusObject extends THREE.Mesh {
    constructor(url: string, onLoad, onUpdate, renderer: THREE.WebGLRenderer, material) {       
        var geometry = new THREE.BufferGeometry();
        // geometry.center = this.nocenter;
        var positions = new Float32Array(3);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        super(geometry, material);

        if (onload !== null && typeof(onLoad) == 'object')
		throw "NexusObject constructor has been changed.";

        var gl = renderer.getContext();
        if(!material)
		    this.autoMaterial = true;

        this.frustumCulled = false;
        var mesh = this;
        var instance = this.geometry.instance = new Nexus.Instance(gl);
    }

    private nocenter() { 
        throw "Centering and in general applying matrix to geometry is unsupported."; 
    }
}