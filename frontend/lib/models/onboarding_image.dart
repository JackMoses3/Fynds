class OnboardingImage {
  final int id;
  final String imageUrl;
  OnboardingImage({required this.id, required this.imageUrl});
  factory OnboardingImage.fromJson(Map<String, dynamic> json) =>
      OnboardingImage(id: json['id'], imageUrl: json['imageUrl']);
}
