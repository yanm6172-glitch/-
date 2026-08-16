"""
微构体导电仿真核心几何算法模块
- 周期性边界条件下的线段裁剪
- 3D线段间最短距离
- 点/线段到平面的最短距离
- Union-Find连通性判定
- 随机颗粒生成
"""
import numpy as np
from scipy.spatial.distance import cdist

# 物理常数
CUBE_SIZE = 10000.0       # 微构体边长 (nm)
CUBE_HALF = 5000.0        # 半边长
R_A = 30.0                # 金属A圆柱半径 (nm)
L_A = 5000.0              # 金属A圆柱长度 (nm)
R_B = 200.0               # 金属B球半径 (nm)
TUNNELING_DIST = 1.8      # 隧穿距离 (nm)
ELECTRODE_LEFT = -5000.0  # 左电极面 X坐标
ELECTRODE_RIGHT = 5000.0  # 右电极面 X坐标


def clamp_to_cube(point):
    """将单个点通过周期性边界条件映射回立方体 [-5000, 5000]^3"""
    return ((point + CUBE_HALF) % CUBE_SIZE) - CUBE_HALF


def segment_periodic_images(p1, p2):
    """
    对线段 p1->p2 应用周期性边界条件，返回落在立方体内的所有分段。

    周期性边界规则：当颗粒超出边界时，超出部分沿超界方向平移一个边长从对侧重新进入。
    实际实现：将线段与立方体的6个边界面求交，返回所有有效分段。

    Args:
        p1, p2: (3,) ndarray, 线段两端点

    Returns:
        list of (p_start, p_end) tuples, 每个元组是立方体内的有效分段
    """
    # 使用均匀采样的方法：在线段上密集采样，将采样点映射回立方体，
    # 然后合并连续的点形成分段
    # 线段长度5000nm，采样步长约50nm，约100个采样点
    seg_len = np.linalg.norm(p2 - p1)
    n_samples = max(int(seg_len / 50) + 2, 20)

    t = np.linspace(0, 1, n_samples)
    points = p1[np.newaxis, :] + t[:, np.newaxis] * (p2 - p1)[np.newaxis, :]

    # 将所有采样点映射回立方体
    mapped = clamp_to_cube(points)

    # 检测跳跃（当映射后的相邻点距离 > 5000nm时，说明穿过了周期边界，需要分段）
    segments = []
    seg_start = mapped[0]

    for i in range(1, len(mapped)):
        dist = np.linalg.norm(mapped[i] - mapped[i-1])
        if dist > CUBE_HALF:  # 穿过了周期边界
            segments.append((seg_start.copy(), mapped[i-1].copy()))
            seg_start = mapped[i].copy()

    segments.append((seg_start.copy(), mapped[-1].copy()))

    return segments


def point_to_segment_distance(p, a, b):
    """点p到线段ab的最短距离"""
    ab = b - a
    ap = p - a
    t = np.dot(ap, ab) / max(np.dot(ab, ab), 1e-12)
    t = np.clip(t, 0, 1)
    closest = a + t * ab
    return np.linalg.norm(p - closest)


def segment_to_segment_distance_3d(a1, a2, b1, b2):
    """
    计算3D空间中两线段之间的最短距离。
    使用参数化方法：找到两线段上最近点对。
    """
    u = a2 - a1
    v = b2 - b1
    w = a1 - b1

    a = np.dot(u, u)
    b = np.dot(u, v)
    c = np.dot(v, v)
    d = np.dot(u, w)
    e = np.dot(v, w)

    denom = a * c - b * b

    if denom < 1e-12:
        # 平行线段
        t = 0.0
        s = np.clip(-d / max(a, 1e-12), 0, 1) if a > 1e-12 else 0.0
    else:
        t = np.clip((b * e - c * d) / denom, 0, 1)
        s = np.clip((a * e - b * d) / denom, 0, 1)

    p_a = a1 + t * u
    p_b = b1 + s * v

    return np.linalg.norm(p_a - p_b)


def periodic_segment_distance(a1, a2, b1, b2):
    """
    考虑周期性边界条件的两线段最短距离。
    计算b线段的所有27个周期镜像与a线段之间的距离，取最小值。
    """
    min_dist = float('inf')

    # 27个周期镜像偏移量：{-10000, 0, 10000}^3
    offsets = np.array([
        [dx, dy, dz]
        for dx in [-CUBE_SIZE, 0, CUBE_SIZE]
        for dy in [-CUBE_SIZE, 0, CUBE_SIZE]
        for dz in [-CUBE_SIZE, 0, CUBE_SIZE]
    ])

    for offset in offsets:
        b1_img = b1 + offset
        b2_img = b2 + offset
        dist = segment_to_segment_distance_3d(a1, a2, b1_img, b2_img)
        if dist < min_dist:
            min_dist = dist

    return min_dist


def cylinder_surface_distance(a1, a2, b1, b2, r1=R_A, r2=R_A):
    """
    两圆柱体表面之间的最短距离。
    = 轴线最短距离 - r1 - r2
    """
    axis_dist = periodic_segment_distance(a1, a2, b1, b2)
    return axis_dist - r1 - r2


def cylinder_to_plane_distance(a1, a2, plane_x, r=R_A):
    """
    圆柱体表面到X=plane_x平面的最短距离。
    通过在线段上密集采样，取各点到平面距离的最小值 - 半径。
    同时考虑周期性边界条件。
    """
    # 采样点
    seg_vec = a2 - a1
    seg_len = np.linalg.norm(seg_vec)
    n_samples = max(int(seg_len / 100) + 2, 10)

    t = np.linspace(0, 1, n_samples)
    points = a1[np.newaxis, :] + t[:, np.newaxis] * seg_vec[np.newaxis, :]

    # 映射到立方体
    mapped = clamp_to_cube(points)

    # 到平面的最短距离
    dists = np.abs(mapped[:, 0] - plane_x)
    min_dist = np.min(dists)

    return min_dist - r


def sphere_to_plane_distance(center, plane_x, r=R_B):
    """球体表面到X=plane_x平面的最短距离"""
    return abs(center[0] - plane_x) - r


def point_to_segment_distance_periodic(p, a1, a2):
    """考虑周期性边界的点到线段最短距离"""
    min_dist = float('inf')
    offsets = np.array([
        [dx, dy, dz]
        for dx in [-CUBE_SIZE, 0, CUBE_SIZE]
        for dy in [-CUBE_SIZE, 0, CUBE_SIZE]
        for dz in [-CUBE_SIZE, 0, CUBE_SIZE]
    ])

    for offset in offsets:
        p_img = p + offset
        dist = point_to_segment_distance(p_img, a1, a2)
        if dist < min_dist:
            min_dist = dist

    return min_dist


def sphere_to_cylinder_distance(sphere_center, cyl_a1, cyl_a2, r_sphere=R_B, r_cyl=R_A):
    """球体表面到圆柱体表面的最短距离"""
    axis_dist = point_to_segment_distance_periodic(sphere_center, cyl_a1, cyl_a2)
    return axis_dist - r_sphere - r_cyl


def sphere_to_sphere_distance(c1, c2, r=R_B):
    """两球体表面之间的最短距离（考虑周期性）"""
    # 周期边界下的两点最短距离
    dx = abs(c1[0] - c2[0])
    dy = abs(c1[1] - c2[1])
    dz = abs(c1[2] - c2[2])

    # 考虑wrap-around
    dx = min(dx, CUBE_SIZE - dx)
    dy = min(dy, CUBE_SIZE - dy)
    dz = min(dz, CUBE_SIZE - dz)

    dist = np.sqrt(dx**2 + dy**2 + dz**2)
    return dist - 2 * r


class UnionFind:
    """并查集数据结构"""
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py:
            return
        if self.rank[px] < self.rank[py]:
            self.parent[px] = py
        elif self.rank[px] > self.rank[py]:
            self.parent[py] = px
        else:
            self.parent[py] = px
            self.rank[px] += 1

    def connected(self, x, y):
        return self.find(x) == self.find(y)


def check_conduction(particles_A, particles_B=None):
    """
    判断微构体是否导通。

    Args:
        particles_A: list of (p1, p2) tuples, 金属A圆柱体两端点
        particles_B: list of (center,) tuples, 金属B球体球心

    Returns:
        bool: 是否导通
    """
    nA = len(particles_A)
    nB = len(particles_B) if particles_B else 0
    n_total = nA + nB

    # 虚拟节点：左电极(index n_total)，右电极(index n_total+1)
    LEFT_ELEC = n_total
    RIGHT_ELEC = n_total + 1

    uf = UnionFind(n_total + 2)

    # 检查每个颗粒与电极的连接
    for i, (a1, a2) in enumerate(particles_A):
        dist_left = cylinder_to_plane_distance(a1, a2, ELECTRODE_LEFT, R_A)
        dist_right = cylinder_to_plane_distance(a1, a2, ELECTRODE_RIGHT, R_A)

        if dist_left <= TUNNELING_DIST:
            uf.union(i, LEFT_ELEC)
        if dist_right <= TUNNELING_DIST:
            uf.union(i, RIGHT_ELEC)

    if particles_B:
        for i, center in enumerate(particles_B):
            idx = nA + i
            dist_left = sphere_to_plane_distance(center, ELECTRODE_LEFT, R_B)
            dist_right = sphere_to_plane_distance(center, ELECTRODE_RIGHT, R_B)

            if dist_left <= TUNNELING_DIST:
                uf.union(idx, LEFT_ELEC)
            if dist_right <= TUNNELING_DIST:
                uf.union(idx, RIGHT_ELEC)

    # 检查颗粒间连接
    # A-A 连接
    for i in range(nA):
        for j in range(i+1, nA):
            d = cylinder_surface_distance(
                particles_A[i][0], particles_A[i][1],
                particles_A[j][0], particles_A[j][1]
            )
            if d <= TUNNELING_DIST:
                uf.union(i, j)

    # A-B 连接
    if particles_B:
        for i in range(nA):
            for j in range(nB):
                d = sphere_to_cylinder_distance(
                    particles_B[j],  # sphere center
                    particles_A[i][0], particles_A[i][1]
                )
                if d <= TUNNELING_DIST:
                    uf.union(i, nA + j)

        # B-B 连接
        for i in range(nB):
            for j in range(i+1, nB):
                d = sphere_to_sphere_distance(particles_B[i], particles_B[j])
                if d <= TUNNELING_DIST:
                    uf.union(nA + i, nA + j)

    return uf.connected(LEFT_ELEC, RIGHT_ELEC)


def generate_random_particle_A():
    """
    随机生成一个金属A圆柱体（长度5000nm，方向随机均匀分布）。
    返回两端点坐标。
    """
    # 随机方向（单位球面上均匀采样）
    phi = np.random.uniform(0, 2 * np.pi)
    cos_theta = np.random.uniform(-1, 1)
    theta = np.arccos(cos_theta)

    dx = np.sin(theta) * np.cos(phi)
    dy = np.sin(theta) * np.sin(phi)
    dz = np.cos(theta)
    direction = np.array([dx, dy, dz])

    # 随机中心点（立方体内均匀分布）
    center = np.random.uniform(-CUBE_HALF, CUBE_HALF, 3)

    # 两个端点
    half_len = L_A / 2.0
    p1 = center - half_len * direction
    p2 = center + half_len * direction

    return p1, p2


def generate_random_particle_B():
    """随机生成一个金属B球体（半径200nm）。返回球心坐标。"""
    center = np.random.uniform(-CUBE_HALF, CUBE_HALF, 3)
    return center


def compute_volume_A():
    """金属A体积 (nm³)"""
    return np.pi * R_A**2 * L_A


def compute_volume_B():
    """金属B体积 (nm³)"""
    return 4/3 * np.pi * R_B**3


def filling_ratio_to_n_A(fr):
    """填充率转金属A颗粒数"""
    V_A = compute_volume_A()
    V_total = CUBE_SIZE**3
    return max(1, int(fr * V_total / V_A))


def filling_ratio_to_n_B(fr):
    """填充率转金属B颗粒数"""
    V_B = compute_volume_B()
    V_total = CUBE_SIZE**3
    return max(1, int(fr * V_total / V_B))


def monte_carlo_conduction(n_A, n_B=0, n_trials=500):
    """
    蒙特卡洛模拟估计导通概率。

    Args:
        n_A: 金属A颗粒数
        n_B: 金属B颗粒数
        n_trials: 模拟次数

    Returns:
        float: 导通概率估计值
    """
    n_conduct = 0
    for _ in range(n_trials):
        particles_A = [generate_random_particle_A() for _ in range(n_A)]
        particles_B = [generate_random_particle_B() for _ in range(n_B)] if n_B > 0 else None

        particles_A_list = [(p[0], p[1]) for p in particles_A]
        particles_B_list = particles_B if particles_B else None

        if check_conduction(particles_A_list, particles_B_list):
            n_conduct += 1

    return n_conduct / n_trials


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')

    print(f"Metal A volume: {compute_volume_A():.2e} nm^3")
    print(f"Metal B volume: {compute_volume_B():.2e} nm^3")
    print(f"0.5% fill ratio -> N_A = {filling_ratio_to_n_A(0.005)}")

    p1, p2 = generate_random_particle_A()
    print(f"Random particle endpoints: {p1}, {p2}")
    print(f"Endpoint distance: {np.linalg.norm(p2-p1):.2f} nm")

    result = check_conduction([(p1, p2)], None)
    print(f"Single particle conduction: {result}")
