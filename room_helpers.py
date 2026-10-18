"""Shared helpers for building the bedroom scene. exec() this at the top of each Blender snippet."""
import bpy
import bmesh
import math
import random
from mathutils import Vector

IMG = "/Users/biquillo/Development/team_litte_big_questions/images/room"


def coll(name="Room"):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def principled(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def mat(name, color, rough=0.85, emission=None, strength=0.0, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = strength
    m.diffuse_color = (*color, 1)
    return m


def first_image(folder):
    import os
    d = os.path.join(IMG, folder)
    f = sorted(x for x in os.listdir(d) if x.lower().endswith((".png", ".jpg")))[-1]
    return bpy.data.images.load(os.path.join(d, f), check_existing=True)


def img_mat(name, folder, rough=0.8, strength=0.0, scale=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = principled(m)
    tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None) or nt.nodes.new("ShaderNodeTexImage")
    tex.image = first_image(folder)
    tex.location = (-400, 200)
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    if strength:
        nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = strength
    if scale != 1.0:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (scale, scale, scale)
        nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    b.inputs["Roughness"].default_value = rough
    return m


def link(ob, c="Room"):
    for uc in ob.users_collection:
        uc.objects.unlink(ob)
    coll(c).objects.link(ob)
    return ob


def box(name, x0, x1, y0, y1, z0, z1, material=None, bevel=0.0, c="Room", parent=None):
    """Axis-aligned box from min/max corners."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll(c).objects.link(ob)
    ob.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    ob.scale = (x1 - x0, y1 - y0, z1 - z0)
    if material:
        me.materials.append(material)
    if bevel:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
    if parent:
        ob.parent = parent
    return ob


def plane(name, center, size, rot, material, c="Room"):
    """Plane of size (w, h) at center, rotated by Euler degrees. UVs fill 0..1."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=center)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    ob.rotation_euler = [math.radians(a) for a in rot]
    ob.data.materials.append(material)
    link(ob, c)
    return ob


def cyl(name, loc, r, depth, material, verts=16, rot=(0, 0, 0), c="Room"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc,
                                        rotation=[math.radians(a) for a in rot])
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(material)
    link(ob, c)
    return ob


def clear_collection(name):
    c = bpy.data.collections.get(name)
    if c:
        for ob in list(c.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
