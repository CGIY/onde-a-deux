# Décodage des illustrations
Chaque fichier .b64 est une image JPEG encodée en base64.
Pour décoder : `base64 -d autre-cadeau-20.b64 > autre-cadeau-20.jpg`
Ou en Python : `import base64; open("x.jpg","wb").write(base64.b64decode(open("x.b64").read()))