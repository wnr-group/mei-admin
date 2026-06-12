CREATE TYPE customization_type AS ENUM (
  'UNSTITCHED', 'SEMI_STITCHED', 'STANDARD_SIZE', 'CUSTOM_TAILORED'
);

CREATE TYPE measurement_field_key AS ENUM (
  'bust', 'upper_bust', 'under_bust', 'waist', 'hip', 'shoulder',
  'blouse_length', 'sleeve_length', 'lehenga_length', 'bottom_length',
  'dupatta_length', 'torso_length', 'back_length', 'front_length',
  'height', 'armhole', 'neck_depth_front', 'neck_depth_back',
  'neck_circumference', 'bicep', 'wrist', 'elbow',
  'inseam', 'thigh', 'knee', 'calf', 'ankle'
);

CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO');
