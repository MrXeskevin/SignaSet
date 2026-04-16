let dataset = []; // { label, vector }[]

const normalize = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return null;
    const wrist = landmarks[0];
    const vector = [];
    landmarks.forEach(p => {
        vector.push(p.x - wrist.x);
        vector.push(p.y - wrist.y);
        vector.push(p.z - wrist.z);
    });
    return vector;
};

const euclideanDistance = (v1, v2) => {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
        sum += Math.pow(v1[i] - v2[i], 2);
    }
    return Math.sqrt(sum);
};

export const loadDataset = (data) => {
    dataset = data.map(entry => ({
        label: entry.label,
        vector: normalize(entry.landmarks)
    })).filter(e => e.vector !== null);
};

export const classify = (landmarks) => {
    if (!dataset.length || !landmarks) {
        return { label: null, confidence: 0 };
    }

    const liveVector = normalize(landmarks);
    if (!liveVector) return { label: null, confidence: 0 };

    // Group distances by label
    const labelDistances = {};
    dataset.forEach(entry => {
        const dist = euclideanDistance(liveVector, entry.vector);
        if (!labelDistances[entry.label]) {
            labelDistances[entry.label] = [];
        }
        labelDistances[entry.label].push(dist);
    });

    // Calculate average distance per label
    const averages = [];
    for (const label in labelDistances) {
        const sum = labelDistances[label].reduce((a, b) => a + b, 0);
        averages.push({
            label,
            avgDist: sum / labelDistances[label].length
        });
    }

    // Sort by distance (asc)
    averages.sort((a, b) => a.avgDist - b.avgDist);

    const best = averages[0];
    const worst = averages[averages.length - 1];

    let confidence = 0;
    if (averages.length > 1 && worst.avgDist > 0) {
        // confidence = 1 - (best_avg_dist / worst_avg_dist)
        confidence = 1 - (best.avgDist / worst.avgDist);
    } else if (averages.length === 1) {
        // If only one label exists, the math gives 0. 
        // We'll return 0 as per literal instruction, though in reality it might be "known".
        confidence = 0;
    }

    return {
        label: best.label,
        confidence: Math.max(0, Math.min(1, confidence))
    };
};
