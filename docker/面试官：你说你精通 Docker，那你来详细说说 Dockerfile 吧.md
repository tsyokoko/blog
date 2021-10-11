# 一、 带着问题学Dockerfile

## 1、疑问

我们都知道从远程仓库可以pull一个tomcat等镜像下来，然后`docker run`启动容器，然后`docker exec -it 容器id /bin/bash`进入容器，往webapps下仍我们的程序。等等这一系列操作，都需要人工一步步的去操作，那我问你：你没qa和生产环境的部署权限，你咋操作这些？这就需要将所有人工一步步操作的地方都写到Dockerfile文件里，然后将文件给到运维人员，他们build成镜像然后进行启动。

## 2、举例

比如：你要用tomcat部署一个war包，这时候你的Dockerfile文件内容会包含如下：

- 将tomcat从远程仓库拉下来
- 进入到tomcat的webapps目录
- 将宿主机上的war包扔到容器的webapps目录下

然后运维拿着这个Dockerfile进行build成image，在run一下启动容器。大功告成

## 3、好处

上面的例子好处不难发现

- Dockerfile解放了手工操作很多步骤
- Dockerfile保证了环境的统一

> 再也不会出现：QA是正常的，线上就是不行的情况了（前提是由于环境问题导致的 ），因为Dockerfile是同一份，大到环境，小到版本全都一致。再有问题那也是代码问题，节省了和运维人员大量“亲密接触”的时间。

# 二、什么是Dockerfile

知道Dockerfile是干嘛的了，那Dockerfile的定义到底是啥呢？

Dockerfile中文名叫**镜像描述文件**，是一个包含用于组合镜像目录的文本文档，也可以叫“脚本”。他通过读取Dockerfile中的指令安装步骤自动生成镜像。

> 补充：文件名称必须是：Dockerfile

# 三、Dockerfile命令

## 1、构建镜像命令

```bash
docker build -t 机构/镜像名称<:tags> Dockerfile目录
# 比如如下，最后一个.代表当前目录，因为我的Dockerfile文件就在这，也可以用绝对路径
docker build -t chentongwei.com/mywebapp:1.0.0 .
# 然后执行docker images 进行查看会发现有我们刚才构建的镜像
docker images
```

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/L3Byb3h5L2h0dHBzL3d3dy5qYXZhemhpeWluLmNvbS93cC1jb250ZW50L3VwbG9hZHMvMjAyMC8wNS9qYXZhMi0xNTkwMzY5NjE0LnBuZw==.jpg)

## 2、基础命令

### 2.1、FROM

```bash
# 制作基准镜像
FROM 镜像
# 比如我们要发布一个应用到tomcat里，那么的第一步就是FROM tomcat
FROM tomcat<:tags>
```

> 先有个印象，下面会实战操作。

### 2.2、LABEL&MAINTAINER

```bash
# MAINTAINER，一般写个人id或组织id
# LABEL 就是注释，方便阅读的，纯注释说明。不会对Dockerfile造成任何影响
# 比如：
MAINTAINER baidu.com
LABEL version = "1.0.0"
LABEL description = "我们是大百度！"
# ...等等描述性信息，纯注释。
```

### 2.3、WORKDIR

```bash
# 类似于Linux中的cd命令，但是他比cd高级的地方在于，我先cd，发现没有这个目录，我就自动创建出来，然后在cd进去
WORKDIR /usr/local/testdir
```

> 这个路径建议使用绝对路径。

### 2.4、ADD&COPY

#### 2.4.1、COPY

```bash
# 将1.txt拷贝到根目录下。它不仅仅能拷贝单个文件，还支持Go语言风格的通配符，比如如下：
COPY 1.txt /
# 拷贝所有 abc 开头的文件到testdir目录下
COPY abc* /testdir/
# ? 是单个字符的占位符，比如匹配文件 abc1.log
COPY abc?.log /testdir/
```

#### 2.4.2、ADD

```bash
# 将1.txt拷贝到根目录的abc目录下。若/abc不存在，则会自动创建
ADD 1.txt /abc
# 将test.tar.gz解压缩然后将解压缩的内容拷贝到/home/work/test
ADD test.tar.gz /home/work/test
```

> docker官方建议当要从远程复制文件时，尽量用curl/wget命令来代替ADD。因为用ADD的时候会创建更多的镜像层。镜像层的size也大。

#### 2.4.3、对比

- 二者都是只复制目录中的文件，而不包含目录本身。
- COPY能干的事ADD都能干，甚至还有附加功能。
- ADD可以支持拷贝的时候顺带解压缩文件，以及添加远程文件（不在本宿主机上的文件）。
- 只是文件拷贝的话可以用COPY，有额外操作可以用ADD代替。

### 2.5、ENV

```bash
# 设置环境常量，方便下文引用，比如：
ENV JAVA_HOME /usr/local/jdk1.8
# 引用上面的常量，下面的RUN指令可以先不管啥意思，目的是想说明下文可以通过${xxx}的方式引用
RUN ${JAVA_HOME}/bin/java -jar xxx.jar
```

> ENV设置的常量，其他地方都可以用${xxx}来引用，将来改的时候只改ENV的变量内容就行。

## 3、运行指令

> 一共有三个：RUN&CMD&ENTRYPOINT

### 1、RUN

#### 1.1、执行时机

RUN指令是在构建镜像时运行，在构建时能修改镜像内部的文件。

#### 1.2、命令格式

> 命令格式不光是RUN独有，而是下面的CMD和ENTRYPOINT都通用。

- SHELL命令格式

比如

```bash
RUN yum -y install vim
```

- EXEC命令格式

比如

```bash
RUN ["yum","-y","install","vim"]
```

- 二者对比

SHELL：当前shell是父进程，生成一个子shell进程去执行脚本，脚本执行完后退出子shell进程，回到当前父shell进程。

EXEC：用EXEC进程替换当前进程，并且保持PID不变，执行完毕后直接退出，不会退回原来的进程。

> 总结：也就是说shell会创建子进程执行，EXEC不会创建子进程。

- 推荐EXEC命令格式

#### 1.3、举例

举个最简单的例子，构建镜像时输出一句话，那么在Dockerfile里写如下即可：

```bash
RUN ["echo", "image is building!!!"]
```

再比如我们要下载vim，那么在Dockerfile里写如下即可：

```bash
RUN ["yum","-y","install","vim"]
```

莫慌，下面会有实战来完完整整的演示。

### 2、CMD

#### 2.1、执行时机

容器启动时执行，而不是镜像构建时执行。

#### 2.2、解释说明

在容器启动的时候执行此命令，且Dockerfile中只有最后一个ENTRYPOINT会被执行，推荐用EXEC格式。重点在于**如果容器启动的时候有其他额外的附加指令，则CMD指令不生效。**

#### 2.3、举例

```bash
CMD ["echo", "container starting..."]
```

### 3、ENTRYPOINT

#### 3.1、执行时机

容器创建时执行，而不是镜像构建时执行。

#### 3.2、解释说明

在容器启动的时候执行此命令，且Dockerfile中只有最后一个ENTRYPOINT会被执行，推荐用EXEC格式。

#### 3.3、举例

```bash
ENTRYPOINT ["ps","-ef"]
```

### 4、代码演示

#### 4.1、执行时机演示

```bash
FROM centos
RUN ["echo", "image building!!!"]
CMD ["echo", "container starting..."]
docker build -t chentongwei.com/test-docker-run .
```

> 构建镜像的过程中发现我们RUN的image building!!! 输出了，所以RUN命令是在镜像构建时执行。而并没有container starting…的输出。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/L3Byb3h5L2h0dHBzL3d3dy5qYXZhemhpeWluLmNvbS93cC1jb250ZW50L3VwbG9hZHMvMjAyMC8wNS9qYXZhOS0xNTkwMzY5NjE0LnBuZw==.jpg)

```bash
docker run chentongwei.com/test-docker-run
```

> 结果：`container starting...`，足以发现CMD命令是在容器启动的时候执行。

#### 4.2、CMD和ENTRYPOINT演示

> ENTRYPOINT和CMD可以共用，若共用则他会一起合并执行。如下Demo：

```bash
FROM centos
RUN ["echo", "image building!!!"]
ENTRYPOINT ["ps"]
CMD ["-ef"]
# 构建镜像
docker build -t chentongwei.com/docker-run .
# 启动容器
docker run chentongwei.com/docker-run
```

输出结果：

```bash
UID        PID  PPID  C STIME TTY          TIME CMD
root         1     0  0 13:02 ?        00:00:00 ps -ef
```

他给我们合并执行了：`ps -ef`，这么做的好处在于如果容器启动的时候添加额外指令，CMD会失效，可以理解成我们可以动态的改变CMD内容而不需要重新构建镜像等操作。比如

```bash
docker run chentongwei.com/docker-run -aux
```

输出结果：

```bash
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  2.0  0.0  46340  1692 ?        Rs   13:02   0:00 ps -aux
```

结果直接变成了 `ps -aux`，CMD命令不执行了。但是ENTRYPOINT一定执行，这也是CMD和ENTRYPOINT的区别之一。

# 四、实战

## 1、部署应用到tomcat

### 1.1、准备工作

```bash
# 在服务器上创建test-dockerfile文件夹
mkdir test-dockerfile
# 进入test-dockerfile目录
cd test-dockerfile
# 创建需要部署到tomcat的应用
mkdir helloworld
# 在helloworld目录下创建index.html写上hello dockerfile
cd helloworld/
vim index.html
```

效果如下图：

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/L3Byb3h5L2h0dHBzL3d3dy5qYXZhemhpeWluLmNvbS93cC1jb250ZW50L3VwbG9hZHMvMjAyMC8wNS9qYXZhMS0xNTkwMzY5NjE0LnBuZw==.jpg)

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/L3Byb3h5L2h0dHBzL3d3dy5qYXZhemhpeWluLmNvbS93cC1jb250ZW50L3VwbG9hZHMvMjAyMC8wNS9qYXZhNy0xNTkwMzY5NjE0LnBuZw==.jpg)

1.2、Dockerfile

```bash
# 在test-dockerfile目录下创建Dockerfile文件，注意大写D，没有后缀。
touch Dockerfile
```

在Dockerfile里写上如下内容

```bash
FROM tomcat:latest
MAINTAINER baidu.com
WORKDIR /usr/local/tomcat/webapps
ADD helloworld ./helloworld
```

逐行解释：

第一行：因为我们要部署应用到tomcat上，所以需要从远程仓库里拉取tomcat作为基础镜像。

第二行：描述性东西，还可以LABEL XXX XXX 添加更详细的注释信息。

第三行：cd到`/usr/local/tomcat/webapps`，发现没有这个目录，我就自动创建出来，然后在cd进去

> 为什么是这个目录呢？因为当我们制作完镜像把容器run起来的时候tomcat的位置是在/usr/local/tomcat，加个/webapps是因为我们要将我们的应用程序扔到webapps下才能跑。如果懵，继续往下看就懂了。

第四行：tomcat有了，tomcat的webapps我们也cd进去了，那还等啥？直接把我们的应用程序拷贝到webapps下就欧了。所以ADD命令宿主机上的helloworld文件夹下的内容拷贝到当前目录（webapps，上一步刚cd进来的）的helloworld文件夹下。

### 1.3、制作镜像

```bash
docker build -t baidu.com/test-helloworld:1.0.0 .
```

> . 代表当前目录。这些命令不懂的看上面的【三、Dockerfile命令】，都是上面提到的。没新知识。

命令执行后的结果

```bash
[root@izm5e3qug7oee4q1y4opibz test-dockerfile]# docker build -t baidu.com/test-helloworld:1.0.0 .
Sending build context to Docker daemon  3.584kB
Step 1/4 : FROM tomcat:latest
 ---> 1b6b1fe7261e
Step 2/4 : MAINTAINER baidu.com
 ---> Running in ac58299b3f38
Removing intermediate container ac58299b3f38
 ---> 5d0da6398f7e
Step 3/4 : WORKDIR /usr/local/tomcat/webapps
 ---> Running in 1c21c39fc58e
Removing intermediate container 1c21c39fc58e
 ---> 9bf9672cd60e
Step 4/4 : ADD helloworld ./helloworld
 ---> 6d67c0d48c20
Successfully built 6d67c0d48c20
Successfully tagged baidu.com/test-helloworld:1.0.0
```

> 好像分了1/2/3/4步呢？这是啥意思。这是镜像分层的概念，下面说。现在只看到SuccessFully就哦了。

再查看下我们的镜像真实存在了吗？

```bash
docker images
```

完美

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/L3Byb3h5L2h0dHBzL3d3dy5qYXZhemhpeWluLmNvbS93cC1jb250ZW50L3VwbG9hZHMvMjAyMC8wNS9qYXZhMS0xNTkwMzY5NjE0LTEucG5n.jpg)

### 1.4、启动容器

```bash
docker run -d -p 8100:8080  baidu.com/test-helloworld:1.0.0
# 然后docker ps查看容器是否存在
docker ps
```

> 浏览器访问：http://服务器ip:8100/helloworld/index.html，很完美。这个helloworld就是我们Dockerfile里自己的应用程序。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/L3Byb3h5L2h0dHBzL3d3dy5qYXZhemhpeWluLmNvbS93cC1jb250ZW50L3VwbG9hZHMvMjAyMC8wNS9qYXZhOC0xNTkwMzY5NjE0LnBuZw==.jpg)

### 1.5、进入容器

```bash
docker exec -it 730f9e144f68 /bin/bash
```

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/L3Byb3h5L2h0dHBzL3d3dy5qYXZhemhpeWluLmNvbS93cC1jb250ZW50L3VwbG9hZHMvMjAyMC8wNS9qYXZhOC0xNTkwMzY5NjE0LTEucG5n.jpg)

疑问1：怎么进入容器后直接在webapps目录下，这就是因为我们这个镜像是用Dockerfile制作的，Dockerfile上面我们自己WORKDIR到webapps目录下的呀。

答疑1：我们ls下可以看到Dockerfile里的helloworld应用就在这里

```bash
root@730f9e144f68:/usr/local/tomcat/webapps# ls
helloworld
```

答疑2：Dockerfile里`WORKDIR /usr/local/tomcat/webapps`了，为啥是这个目录也很清晰了。容器里的tomcat就在这

```bash
root@730f9e144f68:/usr/local/tomcat/webapps# pwd
usr/local/tomcat/webapps
```

## 2、从0制作Redis镜像

> 一般没人制作Redis镜像，Redis有官方的docker镜像，docker pull一下就行。这里是为了演示上面的命令，从0到1的过程。

### 2.1、准备工作

1.去官网下载Redis的源码包，因为我们演示的是Redis从无到有的过程。

2.准备Redis的配置文件`redis-6379.conf`

### 2.2、Dockerfile

```bash
# 将Redis运行在centos上
FROM centos
# 安装Redis所需要的基础库
RUN ["yum", "install", "-y", "gcc", "gcc-c++", "net-tools", "make"]
# 将Redis目录放到/usr/local
WORKDIR /usr/local
# 别忘了ADD命令自带解压缩的功能
ADD redis-4.0.14.tag.gz .
WORKDIR /usr/local/redis-4.0.14/src
# 编译安装Redis
RUN make && make install
WORKDIR /usr/local/redis-4.0.14
# 将配置文件仍到Redis根目录
ADD redis-6379.conf .
# 声明容器中Redis的端口为6379
EXPOSE 6379
# 启动Redis  redis-server redis-6379.conf
CMD ["redis-server", "redis-6379.conf"]
```

### 2.3、制作镜像&&启动容器

```bash
# 制作镜像
docker build -t chentongwei.com/docker-redis .
# 查看
docker images
# 启动容器
docker run -p 6379:6379 chentongwei.com/docker-redis
```

> 上面三套小连招执行完后redis就起来了，可以redis-cli去链接了。也可以docker exec进入容器去查看。

## 3、用docker部署jar包

```bash
FROM openjdk:8-jdk-alpine:latest
ADD target/helloworld-0.0.1-SNAPSHOT.jar /helloworld.jar
ENTRYPOINT ["java","-jar","/helloworld.jar"]
```

然后build成镜像再run启动容器，很简单粗暴。

# 五、补充：镜像分层的概念

## 1、Dockerfile

```bash
FROM tomcat:latest
MAINTAINER baidu.com
WORKDIR /usr/local/tomcat/webapps
ADD helloworld ./helloworld
```

## 2、镜像分层

就拿上面的Dockerfile来build的话，执行过程是如下的：

```bash
Sending build context to Docker daemon  3.584kB
Step 1/4 : FROM tomcat:latest
 ---> 1b6b1fe7261e
Step 2/4 : MAINTAINER baidu.com
 ---> Running in ac58299b3f38
Removing intermediate container ac58299b3f38
 ---> 5d0da6398f7e
Step 3/4 : WORKDIR /usr/local/tomcat/webapps
 ---> Running in 1c21c39fc58e
Removing intermediate container 1c21c39fc58e
 ---> 9bf9672cd60e
Step 4/4 : ADD helloworld ./helloworld
 ---> 6d67c0d48c20
Successfully built 6d67c0d48c20
Successfully tagged baidu.com/test-helloworld:1.0.0
```

会发现我们Dockerfile文件内容一共四行，执行过程也是Step 1/2/3/4四步，这就知道了Dockerfile内容的行数决定了Step的步骤数。

那么每一步都代表啥呢？

其实每一步都会为我们创建一个临时容器，这样做的好处是如果下次再构建这个Dockerfile的时候，直接从cache里读出已有的容器，不重复创建容器，这样大大节省了构建时间，也不会浪费资源重复创建容器。比如如下：

```bash
FROM tomcat:latest
MAINTAINER baidu.com
WORKDIR /usr/local/tomcat/webapps
ADD helloworld ./helloworld
ADD helloworld ./helloworld2
```

> 啥也没动，就是多部署一份helloworld且在容器内部改名为helloworld2，接下来看执行过程

```bash
Step 1/5 : FROM tomcat:latest
 ---> 1b6b1fe7261e
Step 2/5 : MAINTAINER baidu.com
 ---> Using cache
 ---> 5d0da6398f7e
Step 3/5 : WORKDIR /usr/local/tomcat/webapps
 ---> Using cache
 ---> 9bf9672cd60e
Step 4/5 : ADD helloworld ./helloworld
 ---> Using cache
 ---> 6d67c0d48c20
Step 5/5 : ADD helloworld ./helloworld2
 ---> 4e5ffc24522f
Successfully built 4e5ffc24522f
Successfully tagged baidu.com/test-helloworld:1.0.1
```

首先可以发现如下：

1.Step变成了5步。

2.前四步骤用了缓存Using Cache，并没有重复创建容器。Step 1 没有Using Cache是因为它是从本地仓库直接拉取了tomcat:latest当作基础镜像，run的时候会创建容器。

3.第五步重新创建了临时容器。