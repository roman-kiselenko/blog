name := "blog"
@_default:
	just --list

system-info:
  @echo "This is an {{arch()}} machine".

run:
  docker run --name {{ name }} --rm -it -p 8080:8080 --mount type=volume,target=/home/node/pnpm-store -v $(pwd):/home/node/blog local/blog

build-static:
  docker run -it --rm --name {{ name }} --mount type=volume,target=/home/node/pnpm-store -v $(pwd):/home/node/blog -w /home/node/blog local/blog pnpm run build-ghpages

build:
  docker build -t local/blog .

