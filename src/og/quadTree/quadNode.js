goog.provide('og.quadTree.QuadNode');

goog.require('og.planetSegment.PlanetSegment');
goog.require('og.planetSegment.PlanetSegmentMaterial');
goog.require('og.Extent');
goog.require('og.LonLat');
goog.require('og.quadTree');

/* class QuadNode
 *
 *
 *
 */
og.quadTree.QuadNode = function () {
    this.parentNode;
    this.nodes = [];
    this.planetSegment;
    this.partId;
    this.nodeId;
    this.planet;
    this.state;
    this.appliedTerrainNodeId;
    this.appliedTextureNodeId;
    this.sideSize = [0, 0, 0, 0];
    this.hasNeighbor = [];
    this.neighbors = [];
};

og.quadTree.QuadNode._vertOrder = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
og.quadTree.QuadNode._neGridSize = Math.sqrt(og.quadTree.QuadNode._vertOrder.length) - 1;

og.quadTree.QuadNode.createNode = function (planet, partId, parent, id, zoomIndex, extent) {
    var node = new og.quadTree.QuadNode();
    node.partId = partId;
    node.parentNode = parent;
    node.nodeId = partId + id;
    node.planet = planet;
    node.planetSegment = new og.planetSegment.PlanetSegment();
    node.planetSegment.node = node;
    node.planetSegment.planet = planet;
    node.planetSegment.handler = planet.renderer.handler;
    node.planetSegment.assignTileIndexes(zoomIndex, extent);
    node.planetSegment.gridSize = planet.terrainProvider.gridSizeByZoom[zoomIndex];
    node.createBounds(node.planetSegment);
    node.planet.createdNodesCount++;
    return node;
};

og.quadTree.QuadNode.prototype.getCommonSide = function (node) {
    var a = this.planetSegment.extent,
        b = node.planetSegment.extent;
    var a_ne = a.northEast, a_sw = a.southWest,
        b_ne = b.northEast, b_sw = b.southWest;
    var a_ne_lon = a_ne.lon, a_ne_lat = a_ne.lat, a_sw_lon = a_sw.lon, a_sw_lat = a_sw.lat,
        b_ne_lon = b_ne.lon, b_ne_lat = b_ne.lat, b_sw_lon = b_sw.lon, b_sw_lat = b_sw.lat;

    if (a_ne_lon == b_sw_lon && (a_ne_lat <= b_ne_lat && a_sw_lat >= b_sw_lat ||
        a_ne_lat >= b_ne_lat && a_sw_lat <= b_sw_lat)) {
        return og.quadTree.E;
    } else if (a_sw_lon == b_ne_lon && (a_ne_lat <= b_ne_lat && a_sw_lat >= b_sw_lat ||
        a_ne_lat >= b_ne_lat && a_sw_lat <= b_sw_lat)) {
        return og.quadTree.W;
    } else if (a_ne_lat == b_sw_lat && (a_sw_lon >= b_sw_lon && a_ne_lon <= b_ne_lon ||
        a_sw_lon <= b_sw_lon && a_ne_lon >= b_ne_lon)) {
        return og.quadTree.N;
    } else if (a_sw_lat == b_ne_lat && (a_sw_lon >= b_sw_lon && a_ne_lon <= b_ne_lon ||
        a_sw_lon <= b_sw_lon && a_ne_lon >= b_ne_lon)) {
        return og.quadTree.S;
    } else if (a_ne_lon == 20037508.34 && b_sw_lon == -20037508.34) {
        return og.quadTree.E;
    } else if (a_sw.lon == -20037508.34 && b_ne.lon == 20037508.34) {
        return og.quadTree.W;
    }

    return -1;
};

og.quadTree.QuadNode.prototype.createBounds = function (planetSeg) {

    if (!planetSeg.zoomIndex) {
        planetSeg.bsphere.radius = planetSeg.planet.ellipsoid._a;
        planetSeg.bsphere.center = new og.math.Vector3();
    } else if (planetSeg.zoomIndex < this.planet.terrainProvider.minZoom) {
        planetSeg.bbox.setFromExtent(planetSeg.planet.ellipsoid, planetSeg.extent);
        planetSeg.bsphere.setFromExtent(planetSeg.planet.ellipsoid, planetSeg.extent);
    } else {
        var pn = this,
            scale = 0,
            offsetX = 0,
            offsetY = 0;

        while (pn.parentNode && !pn.planetSegment.terrainReady) {
            if (pn.partId === og.quadTree.NW) {
            } else if (pn.partId === og.quadTree.NE) {
                offsetX += Math.pow(2, scale);
            } else if (pn.partId === og.quadTree.SW) {
                offsetY += Math.pow(2, scale);
            } else if (pn.partId === og.quadTree.SE) {
                offsetX += Math.pow(2, scale);
                offsetY += Math.pow(2, scale);
            }
            scale++;
            pn = pn.parentNode;
        }

        if (pn.planetSegment.terrainReady) {
            var gridSize = pn.planetSegment.gridSize / Math.pow(2, scale);
            if (gridSize >= 1) {
                var pVerts = pn.planetSegment.terrainVertices;
                var i0 = gridSize * offsetY;
                var j0 = gridSize * offsetX;
                var ind1 = 3 * (i0 * (pn.planetSegment.gridSize + 1) + j0);
                var ind2 = 3 * ((i0 + gridSize) * (pn.planetSegment.gridSize + 1) + j0 + gridSize);

                planetSeg.bbox.setFromBounds([pVerts[ind1], pVerts[ind2], pVerts[ind1 + 1], pVerts[ind2 + 1], pVerts[ind1 + 2], pVerts[ind2 + 2]]);
                planetSeg.bsphere.setFromBounds([pVerts[ind1], pVerts[ind2], pVerts[ind1 + 1], pVerts[ind2 + 1], pVerts[ind1 + 2], pVerts[ind2 + 2]]);
            } else {
                planetSeg.bbox.setFromExtent(planetSeg.planet.ellipsoid, planetSeg.extent);
                planetSeg.bsphere.setFromExtent(planetSeg.planet.ellipsoid, planetSeg.extent);
            }
        } else {
            planetSeg.bbox.setFromExtent(planetSeg.planet.ellipsoid, planetSeg.extent);
            planetSeg.bsphere.setFromExtent(planetSeg.planet.ellipsoid, planetSeg.extent);
        }
    }
};

og.quadTree.QuadNode.prototype.createChildrenNodes = function () {
    var p = this.planet;
    var ps = this.planetSegment;
    var ext = ps.extent;
    var size = ext.getWidth() * 0.5;
    var ne = ext.northEast, sw = ext.southWest;
    var z = ps.zoomIndex + 1;
    var id = this.nodeId * 4 + 1;
    var c = new og.LonLat(sw.lon + size, sw.lat + size);
    var nd = this.nodes;

    nd[og.quadTree.NW] = og.quadTree.QuadNode.createNode(p, og.quadTree.NW, this, id, z,
        new og.Extent(new og.LonLat(sw.lon, sw.lat + size), new og.LonLat(sw.lon + size, ne.lat)));

    nd[og.quadTree.NE] = og.quadTree.QuadNode.createNode(p, og.quadTree.NE, this, id, z,
        new og.Extent(c, new og.LonLat(ne.lon, ne.lat)));

    nd[og.quadTree.SW] = og.quadTree.QuadNode.createNode(p, og.quadTree.SW, this, id, z,
        new og.Extent(new og.LonLat(sw.lon, sw.lat), c));

    nd[og.quadTree.SE] = og.quadTree.QuadNode.createNode(p, og.quadTree.SE, this, id, z,
         new og.Extent(new og.LonLat(sw.lon + size, sw.lat), new og.LonLat(ne.lon, sw.lat + size)));
};

og.quadTree.QuadNode.prototype.reloadTerrain = function () {

    this.planetSegment.clearBuffers();
    this.planetSegment.deleteElevations();

    if (this.getState() === og.quadTree.WALKTHROUGH) {
        this.planetSegment.loadTerrain();
    }

    for (var i = 0; i < this.nodes.length; i++) {
        this.nodes[i].reloadTerrain();
    }
};

og.quadTree.QuadNode.prototype.getState = function () {
    var pn = this.parentNode;
    while (pn) {
        if (pn.state != og.quadTree.WALKTHROUGH) {
            return og.quadTree.NOTRENDERING;
        }
        pn = pn.parentNode;
    }
    return this.state;
};

og.quadTree.QuadNode.prototype.prepareForRendering = function (cam) {
    if (cam.altitude < 3000000.0) {
        var distance = cam.eye.distance(this.planetSegment.bsphere.center) - this.planetSegment.bsphere.radius;
        var horizon = 3570 * Math.sqrt(cam.altitude);
        if (distance < horizon) {
            this.renderNode();
        } else {
            this.state = og.quadTree.NOTRENDERING;
        }
    } else {
        this.renderNode();
    }
};

og.quadTree.QuadNode.prototype.traverseNodes = function () {
    if (!this.nodes.length) {
        this.createChildrenNodes();
    }
    this.nodes[og.quadTree.NW].renderTree();
    this.nodes[og.quadTree.NE].renderTree();
    this.nodes[og.quadTree.SW].renderTree();
    this.nodes[og.quadTree.SE].renderTree();
};

og.quadTree.QuadNode.prototype.renderTree = function () {
    this.state = og.quadTree.WALKTHROUGH;

    var cam = this.planet.renderer.activeCamera;

    if (cam.frustum.containsSphere(this.planetSegment.bsphere) > 0) {
        if (og.quadTree.acceptableForRender(cam, this.planetSegment.bsphere)) {
            this.prepareForRendering(cam);
        }
        else {
            if (this.planetSegment.zoomIndex < this.planet.terrainProvider.gridSizeByZoom.length - 1) {
                this.traverseNodes();
            }
            else {
                this.prepareForRendering(cam);
            }
        }
    } else {
        this.state = og.quadTree.NOTRENDERING;
    }
};

og.quadTree.QuadNode.prototype.renderNode = function () {

    this.state = og.quadTree.RENDERING;
    var seg = this.planetSegment;

    if (!seg.ready) {
        var gridSize = this.planet.terrainProvider.gridSizeByZoom[seg.zoomIndex];
        seg.gridSize = gridSize;
        this.sideSize = [gridSize, gridSize, gridSize, gridSize];
        seg.createPlainVertices(gridSize);
        seg.terrainVertices = seg.plainVertices;
        seg.createCoordsBuffers(seg.plainVertices, gridSize);
        seg.ready = true;
    }

    if (!seg.terrainReady) {
        seg.loadTerrain();
        this.whileTerrainLoading();
    }

    var vl = this.planet.visibleLayers,
        pm = seg.materials;

    for (var i = 0; i < vl.length; i++) {
        var li = vl[i],
            pml_id = pm[li.id];

        if (!pml_id) {
            pml_id = seg.materials[li.id] = new og.planetSegment.PlanetSegmentMaterial(seg, li);
        }

        if (!pml_id.imageReady) {
            pml_id.loadTileImage();
            this.whileTextureLoading(li.id);
        }
    }

    this.addToRender(this);
};

og.quadTree.QuadNode.prototype.addToRender = function (node) {
    var nodes = this.planet.renderedNodes;
    for (var i = 0; i < nodes.length; i++) {
        var ni = nodes[i];
        var cs = node.getCommonSide(ni);
        if (cs != -1) {
            var opcs = og.quadTree.OPSIDE[cs];
            if (!(node.hasNeighbor[cs] && ni.hasNeighbor[opcs])) {
                var ap = node.planetSegment;
                var bp = ni.planetSegment;
                var ld = ap.gridSize / (bp.gridSize * Math.pow(2, bp.zoomIndex - ap.zoomIndex));

                node.hasNeighbor[cs] = true;
                ni.hasNeighbor[opcs] = true;

                node.neighbors[cs] = ni;
                ni.neighbors[opcs] = node;

                if (ld > 1) {
                    node.sideSize[cs] = Math.ceil(ap.gridSize / ld);
                    ni.sideSize[opcs] = bp.gridSize;
                }
                else if (ld < 1) {
                    node.sideSize[cs] = ap.gridSize;
                    ni.sideSize[opcs] = Math.ceil(bp.gridSize * ld);
                } else {
                    node.sideSize[cs] = ap.gridSize;
                    ni.sideSize[opcs] = bp.gridSize;
                }
            }
        }
    }
    nodes.push(node);
};

og.quadTree.QuadNode.prototype.whileTerrainLoading = function () {

    var pn = this,
        scale = 0,
        offsetX = 0,
        offsetY = 0;

    while (pn.parentNode && !pn.planetSegment.terrainReady) {
        if (pn.partId == og.quadTree.NE) {
            offsetX += Math.pow(2, scale);
        } else if (pn.partId == og.quadTree.SW) {
            offsetY += Math.pow(2, scale);
        } else if (pn.partId == og.quadTree.SE) {
            offsetX += Math.pow(2, scale);
            offsetY += Math.pow(2, scale);
        }
        scale++;
        pn = pn.parentNode;
    }

    if (pn.planetSegment.terrainReady &&
        pn.planetSegment.terrainExists) {
        if (this.appliedTerrainNodeId != pn.nodeId) {

            var gridSize = pn.planetSegment.gridSize / Math.pow(2, scale);

            if (gridSize >= 1) {
                var seg = this.planetSegment,
                    pseg = pn.planetSegment;

                seg.gridSize = gridSize;
                this.sideSize = [gridSize, gridSize, gridSize, gridSize];
                var i0 = gridSize * offsetY;
                var j0 = gridSize * offsetX;
                var tempVertices = og.quadTree.getVerticesArray(pseg.terrainVertices, pseg.gridSize, i0, j0, gridSize);

                seg.deleteBuffers();
                seg.createCoordsBuffers(tempVertices, gridSize);
                seg.refreshIndexesBuffer = true;

                if (seg.zoomIndex > this.planet.terrainProvider.maxZoom) {
                    pn = this;
                    while (pseg.zoomIndex >= this.planet.terrainProvider.maxZoom && !seg.terrainReady) {
                        pn = pn.parentNode;
                        seg.terrainReady = pseg.terrainReady;
                        seg.terrainIsLoading = pseg.terrainIsLoading;
                    }
                    seg.terrainVertices.length = 0;
                    seg.terrainVertices = tempVertices;
                } else {
                    this.appliedTerrainNodeId = pn.nodeId;
                    tempVertices.length = 0;
                }
            } else {
                var seg = this.planetSegment,
                    pseg = pn.planetSegment;

                seg.gridSize = og.quadTree.QuadNode._neGridSize;
                this.sideSize = [seg.gridSize, seg.gridSize, seg.gridSize, seg.gridSize];

                var i0 = Math.floor(gridSize * offsetY);
                var j0 = Math.floor(gridSize * offsetX);

                var insideSize = 1 / gridSize;
                var fullSize = insideSize * pseg.gridSize;


                //v0(x,y,z)             vn 
                //    *---------------------------------->*       insideSize = 4
                //    |        |        |        |     .  ^       fullSize = 16
                //    |        |        |        |   .    |       i0 = 0
                //    |        |        |        | .      |       j0 = 3
                //    *--------*--------*--------*--------*       ofX(offsetX) = 14, t_j0 = 14 % 4 = 2 
                //    |        |        |     .  |        |       ofY(offsetY) = 2,  t_i0 = 2 % 4 = 2 
                //    |        |        |   .    |        |
                //    |        |        |ofX, ofY|        |
                //  vw*--------*--------*--------*--------*ve
                //    |        |      . |        |        |
                //    |        |   .    |        |        |
                //    |        |.       |        |        |
                //    *--------*--------*--------*--------*
                //    |      . |        |        |        |
                //    |   .    |        |        |        |
                //    V.       |        |        |        |
                //    *<----------------------------------*
                //                  vs

                var t_i0 = offsetY - insideSize * i0,
                    t_j0 = offsetX - insideSize * j0;

                //get triangle vertices
                var bigOne = og.quadTree.getVerticesArray(pseg.terrainVertices, pseg.gridSize, i0, j0, 1);

                var v_lt = new og.math.Vector3(bigOne[0], bigOne[1], bigOne[2]),
                    v_rb = new og.math.Vector3(bigOne[9], bigOne[10], bigOne[11]);

                var vn = new og.math.Vector3(bigOne[3] - bigOne[0], bigOne[4] - bigOne[1], bigOne[5] - bigOne[2]),
                    vw = new og.math.Vector3(bigOne[6] - bigOne[0], bigOne[7] - bigOne[1], bigOne[8] - bigOne[2]),
                    ve = new og.math.Vector3(bigOne[3] - bigOne[9], bigOne[4] - bigOne[10], bigOne[5] - bigOne[11]),
                    vs = new og.math.Vector3(bigOne[6] - bigOne[9], bigOne[7] - bigOne[10], bigOne[8] - bigOne[11]);

                var resVerts = [];
                var coords = new og.math.Vector3();
                var vo = og.quadTree.QuadNode._vertOrder;

                for (var i = 0; i < vo.length; i++) {
                    var vi_y = vo[i].y + t_i0,
                        vi_x = vo[i].x + t_j0;
                    if (vi_y + vi_x < insideSize) {
                        coords = og.math.Vector3.add(vn.scaleTo(vi_x / insideSize), vw.scaleTo(vi_y / insideSize)).add(v_lt);
                    } else {
                        coords = og.math.Vector3.add(vs.scaleTo(1 - vi_x / insideSize), ve.scaleTo(1 - vi_y / insideSize)).add(v_rb);
                    }
                    resVerts[i * 3] = coords.x;
                    resVerts[i * 3 + 1] = coords.y;
                    resVerts[i * 3 + 2] = coords.z;
                }

                seg.deleteBuffers();
                seg.createCoordsBuffers(resVerts, seg.gridSize);
                seg.refreshIndexesBuffer = true;

                resVerts.length = 0;
                bigOne.length = 0;
            }
        }
    }
};

/**
 * Static function returns triangles coordinates array due the source triangles array.
 * @param {Array} sourceArr Source array
 * @param {Integer} gridSize SourceArray square matrix size
 * @param {Integer} i0 First row index source array matrix
 * @param {Integer} j0 First column index
 * @param {Integer} size Square matrix result size.
 * @return{Array} The inside quad triangles array.
 */
og.quadTree.getVerticesArray = function (sourceArr, gridSize, i0, j0, size) {
    var res = [];
    var vInd = 0;
    for (var i = i0; i <= i0 + size; i++) {
        for (var j = j0; j <= j0 + size; j++) {
            var ind = 3 * (i * (gridSize + 1) + j);
            res[vInd++] = sourceArr[ind];
            res[vInd++] = sourceArr[ind + 1];
            res[vInd++] = sourceArr[ind + 2];
        }
    }
    return res;
};


og.quadTree.QuadNode.prototype.whileTextureLoading = function (mId) {
    var pn = this,
        texScale = 0,
        texOffsetX = 0,
        texOffsetY = 0,
        notEmpty = false;

    var psegm = pn.planetSegment.materials[mId];
    while (pn.parentNode) {
        if (psegm) {
            if (psegm.imageReady) {
                notEmpty = true;
                break;
            }
        }

        if (pn.partId == og.quadTree.NE) {
            texOffsetX += Math.pow(2, texScale);
        } else if (pn.partId == og.quadTree.SW) {
            texOffsetY += Math.pow(2, texScale);
        } else if (pn.partId == og.quadTree.SE) {
            texOffsetX += Math.pow(2, texScale);
            texOffsetY += Math.pow(2, texScale);
        }
        texScale++;
        pn = pn.parentNode;
        psegm = pn.planetSegment.materials[mId];
    }

    var segm = this.planetSegment.materials[mId];
    if (segm.imageIsLoading) {
        if (notEmpty) {
            segm.texture = psegm.texture;
            segm.texBias[0] = texOffsetX;
            segm.texBias[1] = texOffsetY;
            segm.texBias[2] = 1 / Math.pow(2, texScale);
        }
    }
};

og.quadTree.QuadNode.prototype.clearTree = function () {

    var state = this.getState();

    if (state === og.quadTree.NOTRENDERING) {
        this.destroyBranches(true);
    } else if (state === og.quadTree.RENDERING) {
        this.destroyBranches(false);
    }
    else {
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodes[i].clearTree();
        }
    }
};

og.quadTree.QuadNode.prototype.destroyBranches = function (cls) {

    if (cls) {
        this.planetSegment.clearSegment();
    }

    for (var i = 0; i < this.nodes.length; i++) {
        this.nodes[i].planetSegment.destroySegment();
        this.nodes[i].destroyBranches(false);
    }
    this.nodes.length = 0;
};

og.quadTree.QuadNode.prototype.traverseTree = function (callback) {
    callback(this);
    for (var i = 0; i < this.nodes.length; i++) {
        this.nodes[i].traverseTree(callback);
    }
};