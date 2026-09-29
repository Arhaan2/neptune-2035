"""Original NEPTUNE kit. Run with Blender 4.3.2 --background --python author.py -- ...

Geometry is specified in canonical runtime meters, mapped into Blender Z-up once,
then exported using glTF's documented Y-up conversion. No textures or outside art.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--descriptor', default=str(HERE / 'descriptor.json'))
parser.add_argument('--output', default=str(HERE.parents[2] / 'public/visuals/v2'))
parser.add_argument('--source-dir', required=True, help='Editable .blend and axis proof outside public/')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
descriptor = json.loads(Path(args.descriptor).read_text())
output, source = Path(args.output).resolve(), Path(args.source_dir).resolve()
if output == source or output in source.parents:
    raise ValueError('Editable sources and guides must remain outside shipping output')
output.mkdir(parents=True, exist_ok=True)
source.mkdir(parents=True, exist_ok=True)


def coord(p):
    return Vector((p[0], -p[2], p[1]))


def linear(n):
    return n / 12.92 if n <= 0.04045 else ((n + 0.055) / 1.055) ** 2.4


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials):
        for data in list(datablocks):
            if data.users == 0:
                datablocks.remove(data)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1
    materials = {}
    for role in descriptor['materialRoles']:
        material = bpy.data.materials.new(role['name'])
        material.use_nodes = True
        rgb = tuple(linear(int(role['color'][i:i + 2], 16) / 255) for i in (1, 3, 5))
        bsdf = material.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Metallic'].default_value = role['metalness']
        bsdf.inputs['Roughness'].default_value = role['roughness']
        material.diffuse_color = (*rgb, 1)
        material['role'] = role['name']
        material['stateTint'] = role['stateTint']
        materials[role['name']] = material
    return materials


MATERIALS = {}


def finish(obj, name, role, bevel=0):
    obj.name = name
    obj.data.materials.append(MATERIALS[role])
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
        mod.width, mod.segments = bevel, 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        normal = obj.modifiers.new('Area-weighted corner normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj


def box(name, p, size, role, bevel=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=coord(p))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    return finish(obj, name, role, bevel)


def cylinder(name, p, radius, length, axis, role, vertices=32, bevel=0.003):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, end_fill_type='NGON', location=coord(p))
    obj = bpy.context.object
    obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(coord(axis)).to_euler()
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return finish(obj, name, role, bevel)


def torus(name, p, radius, minor, axis, role, segments=40):
    bpy.ops.mesh.primitive_torus_add(major_segments=segments, minor_segments=6, location=coord(p), major_radius=radius, minor_radius=minor)
    obj = bpy.context.object
    obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(coord(axis)).to_euler()
    for face in obj.data.polygons:
        face.use_smooth = True
    return finish(obj, name, role)


def bolts(name, center, radius, axis, count=8, bolt_radius=0.016):
    # The three possible axis-aligned flange planes; compact merged hex heads.
    for i in range(count):
        t = 2 * math.pi * i / count
        u, v = radius * math.cos(t), radius * math.sin(t)
        offset = (0, u, v) if axis[0] else (u, 0, v) if axis[1] else (u, v, 0)
        cylinder(f'{name}_{i:02}', [center[j] + offset[j] for j in range(3)], bolt_radius, 0.021, axis, 'silver', vertices=6, bevel=0)


def pump():
    box('cast_mounting_base', (0, -0.555, 0), (1.2, 0.09, 0.8), 'graphite', 0.014)
    for x in (-0.43, 0.40):
        for z in (-0.29, 0.29):
            cylinder('base_hold_down', (x, -0.499, z), 0.025, 0.02, (0, 1, 0), 'silver', 6, 0)
    box('motor_saddle', (0.28, -0.43, 0), (0.40, 0.18, 0.40), 'paint', 0.018)
    box('volute_pedestal', (-0.34, -0.41, 0), (0.28, 0.21, 0.39), 'paint', 0.018)
    cylinder('motor_body', (0.29, -0.12, 0), 0.224, 0.47, (1, 0, 0), 'graphite', 40, 0.014)
    for i in range(18):
        angle = i * 2 * math.pi / 18
        part = box(f'motor_cooling_fin_{i:02}', (0.28, -0.12 + math.cos(angle) * 0.236, math.sin(angle) * 0.236), (0.39, 0.047, 0.014), 'silver', 0.002)
        # Rotate local radial fins about the motor's +X axis.
        part.rotation_euler[0] = angle
        bpy.context.view_layer.objects.active = part
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cylinder('motor_end_cap', (0.553, -0.12, 0), 0.229, 0.065, (1, 0, 0), 'paint', 40, 0.008)
    cylinder('motor_vent_insert', (0.589, -0.12, 0), 0.178, 0.012, (1, 0, 0), 'insert', 32, 0)
    for i in range(-3, 4):
        width = 2 * math.sqrt(max(0, 0.159 ** 2 - (i * 0.040) ** 2))
        box('motor_grille', (0.598, -0.12 + i * 0.040, 0), (0.004, 0.012, width), 'graphite', 0)
    box('motor_terminal_enclosure', (0.29, 0.158, 0.04), (0.23, 0.10, 0.22), 'paint', 0.018)
    box('terminal_seam', (0.29, 0.215, 0.04), (0.21, 0.01, 0.20), 'graphite', 0.003)
    cylinder('shaft_coupling', (-0.055, -0.12, 0), 0.103, 0.15, (1, 0, 0), 'insert', 32, 0.004)
    cylinder('coupling_guard', (-0.055, -0.12, 0), 0.147, 0.14, (1, 0, 0), 'silver', 32, 0.009)
    for x in (-0.102, -0.061, -0.020):
        torus('guard_rib', (x, -0.12, 0), 0.148, 0.005, (1, 0, 0), 'graphite', 24)
    # A tapered, asymmetric snail casing distinguishes the head from the motor.
    vertices, faces, n = [], [], 48
    for x, scale in ((-0.48, 0.83), (-0.45, 1), (-0.24, 1), (-0.20, 0.78)):
        for i in range(n):
            t = 2 * math.pi * i / n
            r = (0.277 + 0.035 * (1 + math.sin(t)) / 2) * scale
            vertices.append(tuple(coord((x, -0.12 + r * math.cos(t), r * math.sin(t)))))
    for ring in range(3):
        for i in range(n):
            faces.append((ring*n+i, ring*n+(i+1)%n, (ring+1)*n+(i+1)%n, (ring+1)*n+i))
    faces.extend([tuple(reversed(range(n))), tuple(range(3*n, 4*n))])
    mesh = bpy.data.meshes.new('original_volute_surface')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('original_volute', mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, 'original_volute', 'paint')
    for face in mesh.polygons:
        face.use_smooth = len(face.vertices) == 4
    torus('casing_front_seam', (-0.474, -0.12, 0), 0.226, 0.012, (1, 0, 0), 'silver', 40)
    bolts('casing_fastener', (-0.493, -0.12, 0), 0.221, (1, 0, 0), 8, 0.013)
    cylinder('suction_neck', (-0.537, -0.12, 0), 0.103, 0.094, (1, 0, 0), 'paint', 32, 0.005)
    cylinder('suction_flange', (-0.58, -0.12, 0), 0.163, 0.04, (1, 0, 0), 'silver', 40, 0.004)
    cylinder('suction_dark_recess', (-0.599, -0.12, 0), 0.086, 0.001, (1, 0, 0), 'insert', 32, 0)
    bolts('suction_fastener', (-0.585, -0.12, 0), 0.134, (1, 0, 0), 8, 0.012)
    cylinder('discharge_neck', (-0.32, 0.362, 0.12), 0.095, 0.37, (0, 1, 0), 'paint', 32, 0.005)
    cylinder('discharge_flange', (-0.32, 0.568, 0.12), 0.155, 0.064, (0, 1, 0), 'silver', 40, 0.004)
    cylinder('discharge_dark_recess', (-0.32, 0.597, 0.12), 0.081, 0.001, (0, 1, 0), 'insert', 32, 0)
    bolts('discharge_fastener', (-0.32, 0.576, 0.12), 0.126, (0, 1, 0), 8, 0.012)


def exchanger():
    for x in (-0.78, 0.78):
        box('long_mounting_foot', (x, -1.045, 0), (0.44, 0.11, 1.4), 'graphite', 0.016)
        for z in (-0.58, 0.58):
            cylinder('foundation_fastener', (x, -0.98, z), 0.035, 0.03, (0, 1, 0), 'silver', 6, 0)
    # Gasketed plate pack, visible silver edges and dark separators. Bounded detail;
    # no claim of actual internal plates, channels or heat-transfer area.
    box('opaque_pack_core', (0, -0.025, 0.055), (1.47, 1.59, 0.83), 'insert', 0.035)
    for i in range(27):
        z = -0.35 + i * 0.032
        box(f'plate_edge_{i:02}', (0, -0.025, z), (1.57, 1.69, 0.017), 'silver', 0.007)
    for z in (-0.455, 0.565):
        box('pressure_end_plate', (0, -0.015, z), (1.82, 1.93, 0.115), 'paint', 0.035)
        for x in (-0.865, 0.865):
            box('vertical_frame_rail', (x, 0.005, z), (0.14, 1.91, 0.16), 'graphite', 0.012)
        box('upper_frame_rail', (0, 0.935, z), (1.84, 0.13, 0.165), 'graphite', 0.011)
        box('lower_frame_rail', (0, -0.941, z), (1.84, 0.09, 0.165), 'graphite', 0.011)
    for x in (-0.858, 0.858):
        for y in (-0.72, 0, 0.72):
            cylinder('tie_bar', (x, y, 0.04), 0.026, 1.24, (0, 0, 1), 'silver', 12, 0)
            for z in (-0.565, 0.651):
                cylinder('tie_bar_hex_nut', (x, y, z), 0.052, 0.048, (0, 0, 1), 'silver', 6, 0.003)
                torus('tie_bar_washer', (x, y, z - 0.018), 0.049, 0.006, (0, 0, 1), 'graphite', 16)
    box('top_carry_bar', (0, 1.045, 0.06), (0.13, 0.11, 1.22), 'silver', 0.012)
    box('rear_guide_column', (0, 0.12, 0.615), (0.12, 1.74, 0.12), 'silver', 0.01)
    # Four generic exterior faces. The graph still owns one abstract center anchor
    # for each circuit. No cosmetic channel is connected to a different medium.
    for x in (-0.58, 0.58):
        for y in (-0.55, 0.55):
            cylinder('bounded_flange_neck', (x, y, -0.586), 0.103, 0.105, (0, 0, 1), 'paint', 32, 0.007)
            cylinder('flange_face', (x, y, -0.664), 0.166, 0.063, (0, 0, 1), 'silver', 40, 0.004)
            cylinder('flange_dark_recess', (x, y, -0.697), 0.087, 0.003, (0, 0, 1), 'insert', 32, 0)
            torus('flange_inner_lip', (x, y, -0.692), 0.095, 0.006, (0, 0, 1), 'graphite', 32)
            bolts('flange_hex_fastener', (x, y, -0.68), 0.135, (0, 0, 1), 8, 0.012)
    box('unmarked_service_panel', (0, 0.04, -0.52), (0.42, 0.20, 0.015), 'graphite', 0.012)
    box('service_panel_insert', (0, 0.04, -0.532), (0.34, 0.125, 0.005), 'insert', 0.006)


def empty(name, p=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = coord(p)
    obj.parent = parent
    return obj


def export(path):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_extras=True,
                              export_normals=True, export_texcoords=False,
                              export_cameras=False, export_lights=False,
                              export_animations=False, export_materials='EXPORT')


for template in descriptor['templates']:
    MATERIALS = reset()
    (pump if template['id'] == 'pump' else exchanger)()
    root = empty(f"{template['id']}_canonical_root")
    root['visualKit'] = descriptor['kitId']
    root['visualVersion'] = descriptor['version']
    root['selectionOwner'] = 'canonical parent engineering asset; decorative children are not inventory'
    # Four immutable geometry/material groups keep repeated fasteners inexpensive.
    for role in descriptor['materialRoles']:
        bpy.ops.object.select_all(action='DESELECT')
        objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.data.materials[0].name == role['name']]
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = f"{template['id']}_{role['name']}"
        bpy.context.scene.cursor.location = (0, 0, 0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.parent = root
        obj['materialRole'] = role['name']
        obj['selectionOwner'] = 'parent'
    for anchor in template['logicalAnchors']:
        obj = empty('anchor_' + anchor['id'], anchor['positionM'], root)
        obj['medium'] = anchor['medium']
        obj['direction'] = anchor['direction']
        obj['precision'] = 'abstract center endpoint, not a physical fabrication port'
    bpy.ops.wm.save_as_mainfile(filepath=str(source / f"{template['id']}.blend"))
    export(output / template['file'])

# This nonshipping proof makes the two coordinate conversions inspectable. The
# one-meter interval and asymmetric XYZ point are read through GLTFLoader in tests.
MATERIALS = reset()
root = empty('axis_proof_root')
empty('meter_start', (0, 0, 0), root)
empty('meter_end', (1, 0, 0), root)
empty('asymmetric_xyz', (0.23, 0.41, -0.17), root)
box('asymmetric_reference_part', (0.23, 0.41, -0.17), (0.13, 0.07, 0.03), 'paint', 0)
export(source / 'orientation-proof.glb')
(source / 'authoring-run.json').write_text(json.dumps({
    'blenderVersion': bpy.app.version_string,
    'blenderBuildHash': bpy.app.build_hash.decode(),
    'authoringCoordinates': 'runtime (x,y,z) -> Blender (x,-z,y)',
    'exportSettings': {'format': 'GLB', 'export_yup': True, 'export_apply': True, 'export_extras': True, 'export_normals': True, 'export_texcoords': False, 'export_cameras': False, 'export_lights': False, 'export_animations': False},
    'guideShipping': False,
    'originalGeometry': True,
    'externalAssets': [],
}, indent=2) + '\n')
print('NEPTUNE original Blender kit exported:', output)
