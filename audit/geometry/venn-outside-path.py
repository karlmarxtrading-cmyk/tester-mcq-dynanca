#!/usr/bin/env python3
"""Read-only reconstruction of the three-circle union hole, no dependencies.

Splits each boundary at exact circle intersections and keeps arcs outside
the other disks. Their endpoints join into the union's exterior. Sampling
uses <= 2*pi/192 radians, matching the original static polygon resolution.
Only the outside highlight changes; existing exclusive region paths stay.
"""
import math

CIRCLES = [(165, 105, 72), (235, 105, 72), (200, 155, 72)]

def point(circle, angle):
    x, y, radius = circle
    return (x + radius * math.cos(angle), y + radius * math.sin(angle))

def union_boundary():
    arcs = []
    tau = 2 * math.pi
    for i, circle in enumerate(CIRCLES):
        angles = [0.0]
        x, y, radius = circle
        for j, (ox, oy, other_radius) in enumerate(CIRCLES):
            if i == j:
                continue
            distance = math.hypot(ox - x, oy - y)
            bearing = math.atan2(oy - y, ox - x)
            offset = math.acos((radius * radius + distance * distance - other_radius * other_radius) / (2 * radius * distance))
            angles.extend([(bearing - offset) % tau, (bearing + offset) % tau])
        angles = sorted(set(angles))
        for start, end in zip(angles, angles[1:] + [angles[0] + tau]):
            px, py = point(circle, (start + end) / 2)
            if any(math.hypot(px - ox, py - oy) < r - 1e-8 for j, (ox, oy, r) in enumerate(CIRCLES) if j != i):
                continue
            n = max(1, math.ceil((end - start) / (tau / 192)))
            arcs.append([point(circle, start + (end - start) * k / n) for k in range(n + 1)])
    boundary = arcs.pop(0)
    while arcs:
        index = next(i for i, arc in enumerate(arcs) if math.dist(boundary[-1], arc[0]) < 1e-7)
        boundary.extend(arcs.pop(index)[1:])
    assert math.dist(boundary[-1], boundary[0]) < 1e-7
    return boundary

def outside_path():
    # The outer subpath follows the universe rectangle's rounded corners.
    outer = 'M 36,20 L 364,20 Q 380,20 380,36 L 380,229 Q 380,245 364,245 L 36,245 Q 20,245 20,229 L 20,36 Q 20,20 36,20 Z '
    points = union_boundary()
    hole = 'M ' + ' L '.join(f'{x:.1f},{y:.1f}' for x, y in points[:-1]) + ' Z'
    return outer + hole

if __name__ == '__main__':
    print(outside_path())
