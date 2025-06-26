class Style {
  final int id;
  final String name;
  final String? imageUrlMale;
  final String? imageUrlFemale;
  final String? description;

  Style({
    required this.id,
    required this.name,
    this.imageUrlMale,
    this.imageUrlFemale,
    this.description,
  });

  factory Style.fromJson(Map<String, dynamic> json) {
    return Style(
      id: json['id'],
      name: json['name'],
      imageUrlMale: json['imageUrl'],
      imageUrlFemale: json['imageUrlFemale'],
      description: json['description'],
    );
  }
}
