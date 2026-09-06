name := "blog"
agent := "-p 7777:7777 -v $HOME/Documents/dev/opensource/container-machine-images/agent:/home/node/.pi/agent"
@_default:
	just --list

system-info:
  @echo "This is an {{arch()}} machine".

run:
  container run --name {{ name }} --rm -it -p 8080:8080 --mount type=volume,target=/home/node/pnpm-store -v $(pwd):/home/node/blog {{ agent }} local/blog

build-static:
  container run -it --rm --name {{ name }} --mount type=volume,target=/home/node/pnpm-store -v $(pwd):/home/node/blog -w /home/node/blog local/blog pnpm run build-ghpages

build:
  container build -t local/blog -f Dockerfile

