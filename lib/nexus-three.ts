import * as THREE from 'three';

export default class NexusObject extends THREE.Mesh {
    constructor(url: string, onLoad: any, onUpdate: any, renderer: THREE.WebGLRenderer, material: any) {       
        // TODO
        super();
    }

    private nocenter() { 
        throw "Centering and in general applying matrix to geometry is unsupported."; 
    }
}